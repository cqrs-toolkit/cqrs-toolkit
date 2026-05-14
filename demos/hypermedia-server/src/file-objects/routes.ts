/**
 * FileObject API routes — permit-based upload, command envelope, and queries.
 */

import {
  type DemoEventStore,
  type TempFileStore,
  parseFileResource,
} from '@cqrs-toolkit/demo-base/common/server'
import {
  FileObjectAggregate,
  type FileObjectRepository,
} from '@cqrs-toolkit/demo-base/file-objects/server'
import type { NoteRepository } from '@cqrs-toolkit/demo-base/notes/server'
import type { EventCursorPagination, HypermediaTypes } from '@cqrs-toolkit/hypermedia'
import { BadRequestException, Hypermedia, NotFoundException } from '@cqrs-toolkit/hypermedia/server'
import type { ISerializedEvent } from '@meticoeus/ddd-es'
import type { FastifyInstance, FastifyPluginAsync, RouteShorthandOptions } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import {
  commandRouteConfig,
  extractCommandMetadata,
  toCommandSuccess,
  toSerializedEvent,
} from '../command-utils.js'
import { handleErrorReply } from '../problems/index.js'
import {
  GetAggregateEventsRequest,
  GetByIdRequest,
  GetItemEventsRequest,
  GetListRequest,
} from '../query-utils.js'
import { FileObjectCommandIds, FileObjectCommands } from './command/doc.js'
import { FILE_OBJECT_COMMANDS, type FileObjectMutationCommand } from './command/planner.js'
import { GetFileObjectById } from './query/GetFileObjectById.js'
import { GetFileObjects } from './query/GetFileObjects.js'
import {
  FileObjectAggregateEventClass,
  FileObjectItemEventClass,
  HalFileObjectAggregateEvent,
  HalFileObjectAggregateEventCollection,
  HalFileObjectItemEvent,
  HalFileObjectItemEventCollection,
} from './query/doc.js'
import { FileObjectRepV1_0_0 } from './query/v1_0_0/representation.js'
import { signFields } from './signing.js'

const permitRouteConfig: RouteShorthandOptions = {
  schema: {
    body: { type: 'object' },
  },
}

const itemEventsFormatConfig: Hypermedia.CollectionFormatConfig = {
  halDefs: [HalFileObjectItemEvent],
  collectionDef: HalFileObjectItemEventCollection,
  linkDensity: 'omit',
}

const aggregateEventsFormatConfig: Hypermedia.CollectionFormatConfig = {
  halDefs: [HalFileObjectAggregateEvent],
  collectionDef: HalFileObjectAggregateEventCollection,
  linkDensity: 'omit',
}

export function fileObjectRoutes(
  eventStore: DemoEventStore,
  fileObjectRepo: FileObjectRepository,
  noteRepo: NoteRepository,
  fileStore: TempFileStore,
  uploadBaseUrl: string,
): FastifyPluginAsync {
  return async function routes(app: FastifyInstance): Promise<void> {
    // ── Query routes ──

    app.get<GetListRequest>(
      FileObjectRepV1_0_0.collectionHref,
      { schema: GetFileObjects.schema },
      async (request, reply) => {
        await GetFileObjects.resolve(request, reply, fileObjectRepo)
      },
    )

    app.get<GetByIdRequest>(
      FileObjectRepV1_0_0.resourcePath,
      { schema: GetFileObjectById.schema },
      async (request, reply) => {
        await GetFileObjectById.resolve(request, reply, fileObjectRepo)
      },
    )

    app.get<{ Params: { id: string } }>(
      '/api/file-objects/:id/download',
      async (request, reply) => {
        const fileObject = fileObjectRepo.findById(request.params.id)
        if (!fileObject) {
          return handleErrorReply(request, reply, new NotFoundException('FileObject not found'))
        }
        const params = new URLSearchParams({
          'response-content-type': fileObject.contentType,
          'response-content-disposition': `attachment; filename="${fileObject.name}"`,
          sig: 'demo',
          exp: '3600',
        })
        const presigned = `${uploadBaseUrl}/s3/files/${fileObject.id}?${params}`
        return reply.code(307).header('Location', presigned).send()
      },
    )

    app.get<GetItemEventsRequest>(FileObjectRepV1_0_0.itemEvents.path, async (request, reply) => {
      const { id } = request.params
      const raw = request.query.afterRevision
      const fromRevision = raw !== undefined ? BigInt(raw) + 1n : 0n
      const streamName = FileObjectAggregate.getStreamName(id)
      const persisted = await eventStore.getEventsForAggregateFromRevision(streamName, fromRevision)
      const serialized = persisted.map((e) => toSerializedEvent(e))

      const connection: EventCursorPagination.Connection<ISerializedEvent> = {
        entities: serialized,
        nextCursor: null,
      }
      const page = Hypermedia.eventPageViewFromCursor(connection, {
        path: FileObjectRepV1_0_0.itemEvents.hrefBase.replace('{id}', id),
        query: request.query,
        revision: true,
      })
      const cd = Hypermedia.buildCollectionDescriptor({
        connection,
        page,
        buildMember: (data): HypermediaTypes.ResourceDescriptor => ({
          class: FileObjectItemEventClass,
          properties: data,
        }),
        context: { id },
      })
      const { contentType, body } = Hypermedia.formatCollection(request, cd, itemEventsFormatConfig)
      reply.type(contentType).send(body)
    })

    app.get<GetAggregateEventsRequest>(
      FileObjectRepV1_0_0.aggregateEvents.path,
      async (request, reply) => {
        const limit = parseInt(request.query.limit ?? '100', 10)
        const cursor = request.query.cursor
        const afterPosition = cursor ? BigInt(cursor) : undefined

        const events = eventStore
          .getGlobalEvents(afterPosition, limit + 1)
          .filter((e) => e.streamId.startsWith('storage.FileObject-'))

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
          path: FileObjectRepV1_0_0.aggregateEvents.hrefBase,
          query: request.query,
        })
        const cd = Hypermedia.buildCollectionDescriptor({
          connection,
          page,
          buildMember: (data): HypermediaTypes.ResourceDescriptor => ({
            class: FileObjectAggregateEventClass,
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

    // ── Permit (create) route ──

    app.post(
      FileObjectCommands.mustSurface('create').path,
      permitRouteConfig,
      async (request, reply) => {
        const metadataRes = extractCommandMetadata(request)
        if (!metadataRes.ok) return handleErrorReply(request, reply, metadataRes.error)
        const metadata = metadataRes.value

        const valRes = FILE_OBJECT_COMMANDS.parse<{
          noteId: string
          filename: string
          size: number
        }>(request, reply, request.body, FileObjectCommandIds.CreateFileObject)
        if (!valRes.ok) return handleErrorReply(request, reply, valRes.error)
        if (valRes.value.kind === 'replied') return

        const { noteId, filename, size } = valRes.value.value
        const note = noteRepo.findById(noteId)
        if (!note) {
          return handleErrorReply(request, reply, new NotFoundException('Note not found'))
        }

        const fileId = uuidv4()
        const fields: Record<string, string> = {
          fileId,
          noteId,
          filename,
          size: String(size),
          metadata: JSON.stringify(metadata),
        }
        const signature = signFields(fields)

        const uploadUrl = `${uploadBaseUrl}/s3/files`

        return {
          id: fileId,
          data: {
            uploadForm: {
              url: uploadUrl,
              fields: { ...fields, signature },
            },
          },
        }
      },
    )

    // ── Command envelope route ──

    app.post<{
      Params: { id: string }
      Body: { type: string; data: unknown; revision?: string }
    }>(
      FileObjectCommands.mustSurface('command').path,
      commandRouteConfig,
      async (request, reply) => {
        const metadataRes = extractCommandMetadata(request)
        if (!metadataRes.ok) return handleErrorReply(request, reply, metadataRes.error)
        const metadata = metadataRes.value

        const { type, data, revision } = request.body
        const res = FILE_OBJECT_COMMANDS.parseCommandDispatch<FileObjectMutationCommand>(
          request,
          reply,
          data,
          type,
        )
        if (!res.ok) return handleErrorReply(request, reply, res.error)
        if (res.value.kind === 'replied') return

        const aggregate = await fileObjectRepo.getById(request.params.id)
        if (!aggregate) {
          return handleErrorReply(request, reply, new NotFoundException('FileObject not found'))
        }

        const expectedRevision = revision !== undefined ? BigInt(revision) : undefined
        const { stableId } = res.value

        switch (stableId) {
          case FileObjectCommandIds.DeleteFileObject: {
            const fileObj = fileObjectRepo.findById(request.params.id)
            aggregate.markDeleted(metadata)
            const saveRes = await fileObjectRepo.save(aggregate, expectedRevision ?? 0n)
            if (!saveRes.ok) return handleErrorReply(request, reply, saveRes.error)
            if (fileObj) {
              fileStore.delete(parseFileResource(fileObj.resource))
            }
            return toCommandSuccess(
              request.params.id,
              saveRes.value.nextExpectedRevision,
              saveRes.value.events ?? [],
            )
          }
          default:
            return handleErrorReply(
              request,
              reply,
              new BadRequestException(`Unknown command: ${stableId}`),
            )
        }
      },
    )
  }
}
