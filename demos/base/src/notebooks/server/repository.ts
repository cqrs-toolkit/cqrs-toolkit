/**
 * Notebook repository — extends Repository with a read model cache for queries.
 */

import type { Notebook } from '@cqrs-toolkit/demo-base/notebooks/shared'
import {
  Repository,
  type ConcurrencyException,
  type EventConflictException,
  type EventRevision,
  type IEventStore,
  type Result,
  type SaveEventSuccess,
} from '@meticoeus/ddd-es'
import { NotebookAggregate, type NotebookServerEvent } from './aggregate.js'

export class NotebookRepository extends Repository<NotebookServerEvent, NotebookAggregate> {
  private readonly readModels = new Map<string, Notebook>()

  protected override async persistEvents(
    aggregate: NotebookAggregate,
    events: NotebookServerEvent[],
    expectedRevision: EventRevision,
  ) {
    const topic = `Notebook:${aggregate.id}`
    const tagged = events.map((e) => ({ ...e, metadata: { ...e.metadata, topic } }))
    return super.persistEvents(aggregate, tagged, expectedRevision)
  }

  constructor(storage: IEventStore) {
    super(NotebookAggregate, storage)
  }

  override async save(
    aggregate: NotebookAggregate,
    expectedRevision: EventRevision,
  ): Promise<
    Result<SaveEventSuccess<NotebookServerEvent>, ConcurrencyException | EventConflictException>
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

  findById(id: string): Notebook | undefined {
    return this.readModels.get(id)
  }

  findByName(name: string): Notebook | undefined {
    for (const notebook of this.readModels.values()) {
      if (notebook.name === name) return notebook
    }
    return undefined
  }

  list(cursor?: string, limit = 50): { items: Notebook[]; nextCursor: string | null } {
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
