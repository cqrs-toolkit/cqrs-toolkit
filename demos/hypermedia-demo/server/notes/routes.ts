/**
 * Note API routes — command and query registration.
 */

import { DemoEventStore } from '@cqrs-toolkit/demo-base/common/server'
import type { CommandResponse } from '@cqrs-toolkit/demo-base/common/shared'
import { type NotebookRepository } from '@cqrs-toolkit/demo-base/notebooks/server'
import { NoteAggregate, type NoteRepository } from '@cqrs-toolkit/demo-base/notes/server'
import type { EventCursorPagination, HypermediaTypes } from '@cqrs-toolkit/hypermedia'
import { Hypermedia } from '@cqrs-toolkit/hypermedia/server'
import { EventExistenceRevision, type ISerializedEvent } from '@meticoeus/ddd-es'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import {
  commandRouteConfig,
  createRouteConfig,
  extractCommandMetadata,
  handleErr,
  toCommandSuccess,
  toSerializedEvent,
} from '../command-utils.js'
import {
  GetAggregateEventsRequest,
  GetByIdRequest,
  GetItemEventsRequest,
  GetListRequest,
} from '../query-utils.js'
import { NoteCommandIds, NoteCommands } from './command/doc.js'
import { NOTE_COMMANDS, type NoteMutationCommand } from './command/planner.js'
import { GetNoteById } from './query/GetNoteById.js'
import { GetNotes } from './query/GetNotes.js'
import {
  HalNoteAggregateEvent,
  HalNoteAggregateEventCollection,
  HalNoteItemEvent,
  HalNoteItemEventCollection,
  NoteAggregateEventClass,
  NoteItemEventClass,
} from './query/doc.js'
import { NoteRepV1_0_0 } from './query/v1_0_0/representation.js'

const itemEventsFormatConfig: Hypermedia.CollectionFormatConfig = {
  halDefs: [HalNoteItemEvent],
  collectionDef: HalNoteItemEventCollection,
  linkDensity: 'omit',
}

const aggregateEventsFormatConfig: Hypermedia.CollectionFormatConfig = {
  halDefs: [HalNoteAggregateEvent],
  collectionDef: HalNoteAggregateEventCollection,
  linkDensity: 'omit',
}

export function noteRoutes(
  eventStore: DemoEventStore,
  noteRepo: NoteRepository,
  notebookRepo: NotebookRepository,
): FastifyPluginAsync {
  return async function routes(app: FastifyInstance): Promise<void> {
    // ── Query routes ──

    app.get<GetListRequest>(
      NoteRepV1_0_0.collectionHref,
      { schema: GetNotes.schema },
      async (request, reply) => {
        await GetNotes.resolve(request, reply, noteRepo)
      },
    )

    app.get<GetByIdRequest>(
      NoteRepV1_0_0.resourcePath,
      { schema: GetNoteById.schema },
      async (request, reply) => {
        await GetNoteById.resolve(request, reply, noteRepo)
      },
    )

    app.get<GetItemEventsRequest>(NoteRepV1_0_0.itemEvents.path, async (request, reply) => {
      const { id } = request.params
      const raw = request.query.afterRevision
      const fromRevision = raw !== undefined ? BigInt(raw) + 1n : 0n
      const streamName = NoteAggregate.getStreamName(id)
      const persisted = await eventStore.getEventsForAggregateFromRevision(streamName, fromRevision)
      const serialized = persisted.map((e) => toSerializedEvent(e))

      const connection: EventCursorPagination.Connection<ISerializedEvent> = {
        entities: serialized,
        nextCursor: null,
      }
      const page = Hypermedia.eventPageViewFromCursor(connection, {
        path: NoteRepV1_0_0.itemEvents.hrefBase.replace('{id}', id),
        query: request.query,
        revision: true,
      })
      const cd = Hypermedia.buildCollectionDescriptor({
        connection,
        page,
        buildMember: (data): HypermediaTypes.ResourceDescriptor => ({
          class: NoteItemEventClass,
          properties: data,
        }),
        context: { id },
      })
      const { contentType, body } = Hypermedia.formatCollection(request, cd, itemEventsFormatConfig)
      reply.type(contentType).send(body)
    })

    app.get<GetAggregateEventsRequest>(
      NoteRepV1_0_0.aggregateEvents.path,
      async (request, reply) => {
        const limit = parseInt(request.query.limit ?? '100', 10)
        const cursor = request.query.cursor
        const afterPosition = cursor ? BigInt(cursor) : undefined

        const events = eventStore
          .getGlobalEvents(afterPosition, limit + 1)
          .filter((e) => e.streamId.startsWith('Note-'))

        const items = events.slice(0, limit)
        const hasMore = events.length > limit
        const serialized = items.map((e) => toSerializedEvent(e))
        const lastEvent = items[items.length - 1]
        const nextCursor = hasMore && lastEvent ? String(lastEvent.position) : null

        const connection: EventCursorPagination.Connection<ISerializedEvent> = {
          entities: serialized,
          nextCursor,
        }
        const page = Hypermedia.eventPageViewFromCursor(connection, {
          path: NoteRepV1_0_0.aggregateEvents.hrefBase,
          query: request.query,
        })
        const cd = Hypermedia.buildCollectionDescriptor({
          connection,
          page,
          buildMember: (data): HypermediaTypes.ResourceDescriptor => ({
            class: NoteAggregateEventClass,
            properties: data,
          }),
        })
        const { contentType, body } = Hypermedia.formatCollection(
          request,
          cd,
          aggregateEventsFormatConfig,
        )
        reply.type(contentType).send(body)
      },
    )

    // ── Create route ──

    app.post(NoteCommands.mustSurface('create').path, createRouteConfig, async (request, reply) => {
      const metadataRes = extractCommandMetadata(request)
      if (!metadataRes.ok) return handleErr(metadataRes, reply)
      const metadata = metadataRes.value

      const valRes = NOTE_COMMANDS.parse<{ notebookId: string; title: string; body: string }>(
        request,
        reply,
        request.body,
        NoteCommandIds.CreateNote,
      )
      if (!valRes.ok) {
        reply.code(400)
        return { message: valRes.error.message } satisfies CommandResponse
      }
      if (valRes.value.kind === 'replied') return

      const notebook = notebookRepo.findById(valRes.value.value.notebookId)
      if (!notebook) {
        reply.code(404)
        return { message: 'Notebook not found' } satisfies CommandResponse
      }

      const id = uuidv4()
      const aggregate = new NoteAggregate()
      aggregate.create(valRes.value.value, id, metadata)
      const result = await noteRepo.save(aggregate, EventExistenceRevision.NoStream)
      if (!result.ok) {
        reply.code(result.error.code ?? 500)
        return { message: result.error.message } satisfies CommandResponse
      }
      return toCommandSuccess(id, result.value.nextExpectedRevision, result.value.events ?? [])
    })

    // ── Command envelope route ──

    app.post<{
      Params: { id: string }
      Body: { type: string; data: unknown; revision?: string }
    }>(NoteCommands.mustSurface('command').path, commandRouteConfig, async (request, reply) => {
      const metadataRes = extractCommandMetadata(request)
      if (!metadataRes.ok) return handleErr(metadataRes, reply)
      const metadata = metadataRes.value

      const { type, data, revision } = request.body
      const res = NOTE_COMMANDS.parseCommandDispatch<NoteMutationCommand>(
        request,
        reply,
        data,
        type,
      )
      if (!res.ok) {
        reply.code(400)
        return { message: res.error.message } satisfies CommandResponse
      }
      if (res.value.kind === 'replied') return

      const aggregate = await noteRepo.getById(request.params.id)
      if (!aggregate) {
        reply.code(404)
        return { message: 'Note not found' } satisfies CommandResponse
      }

      const expectedRevision = revision !== undefined ? BigInt(revision) : undefined
      const { stableId } = res.value

      switch (stableId) {
        case NoteCommandIds.UpdateNoteTitle:
          aggregate.updateTitle(res.value.data, metadata)
          break
        case NoteCommandIds.UpdateNoteBody:
          aggregate.updateBody(res.value.data, metadata)
          break
        case NoteCommandIds.DeleteNote:
          aggregate.markDeleted(metadata)
          break
        default:
          reply.code(400)
          return { message: `Unknown command: ${stableId}` } satisfies CommandResponse
      }

      const saveRes = await noteRepo.save(aggregate, expectedRevision ?? 0n)
      if (!saveRes.ok) {
        reply.code(saveRes.error.code ?? 500)
        return { message: saveRes.error.message } satisfies CommandResponse
      }
      return toCommandSuccess(
        request.params.id,
        saveRes.value.nextExpectedRevision,
        saveRes.value.events ?? [],
      )
    })
  }
}
