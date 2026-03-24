/**
 * Note repository — extends Repository with a read model cache for queries.
 */

import type { Note } from '@cqrs-toolkit/demo-base/notes/shared'
import {
  Repository,
  type ConcurrencyException,
  type EventConflictException,
  type EventRevision,
  type IEventStore,
  type Result,
  type SaveEventSuccess,
} from '@meticoeus/ddd-es'
import { NoteAggregate, type NoteServerEvent } from './aggregate.js'

export class NoteRepository extends Repository<NoteServerEvent, NoteAggregate> {
  private readonly readModels = new Map<string, Note>()

  protected override async persistEvents(
    aggregate: NoteAggregate,
    events: NoteServerEvent[],
    expectedRevision: EventRevision,
  ) {
    const topic = `Notebook:${aggregate.notebookId}`
    const tagged = events.map((e) => ({ ...e, metadata: { ...e.metadata, topic } }))
    return super.persistEvents(aggregate, tagged, expectedRevision)
  }

  constructor(storage: IEventStore) {
    super(NoteAggregate, storage)
  }

  override async save(
    aggregate: NoteAggregate,
    expectedRevision: EventRevision,
  ): Promise<
    Result<SaveEventSuccess<NoteServerEvent>, ConcurrencyException | EventConflictException>
  > {
    const result = await super.save(aggregate, expectedRevision)

    if (result.ok) {
      if (aggregate.deleted) {
        this.readModels.delete(aggregate.id)
      } else {
        this.readModels.set(aggregate.id, aggregate.toReadModel())
      }
    }

    return result
  }

  clear(): void {
    this.readModels.clear()
  }

  findById(id: string): Note | undefined {
    return this.readModels.get(id)
  }

  findByNotebookId(notebookId: string): Note[] {
    return Array.from(this.readModels.values()).filter((n) => n.notebookId === notebookId)
  }

  list(cursor?: string, limit = 50): { items: Note[]; nextCursor: string | null } {
    const sorted = Array.from(this.readModels.values()).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )

    let startIndex = 0
    if (cursor) {
      startIndex = sorted.findIndex((n) => n.id === cursor)
      if (startIndex === -1) startIndex = 0
      else startIndex += 1
    }

    const items = sorted.slice(startIndex, startIndex + limit)
    const hasMore = startIndex + limit < sorted.length
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null

    return { items, nextCursor }
  }
}
