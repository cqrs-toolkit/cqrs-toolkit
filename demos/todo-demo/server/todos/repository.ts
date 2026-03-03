/**
 * Todo repository — extends Repository with a read model cache for queries.
 */

import {
  Repository,
  type ConcurrencyException,
  type EventConflictException,
  type EventRevision,
  type IEventStore,
  type Result,
  type SaveEventSuccess,
} from '@meticoeus/ddd-es'
import type { Todo } from '../../shared/todos/types.js'
import { TodoAggregate, type TodoServerEvent } from './aggregate.js'

export class TodoRepository extends Repository<TodoServerEvent, TodoAggregate> {
  private readonly _readModels = new Map<string, Todo>()

  protected override async persistEvents(
    aggregate: TodoAggregate,
    events: TodoServerEvent[],
    expectedRevision: EventRevision,
  ) {
    const topic = `Todo:${aggregate.id}`
    const tagged = events.map((e) => ({ ...e, metadata: { ...e.metadata, topic } }))
    return super.persistEvents(aggregate, tagged, expectedRevision)
  }

  constructor(storage: IEventStore) {
    super(TodoAggregate, storage)
  }

  override async save(
    aggregate: TodoAggregate,
    expectedRevision: EventRevision,
  ): Promise<
    Result<SaveEventSuccess<TodoServerEvent>, ConcurrencyException | EventConflictException>
  > {
    const result = await super.save(aggregate, expectedRevision)

    if (result.ok) {
      if (aggregate.deleted) {
        this._readModels.delete(aggregate.id)
      } else {
        this._readModels.set(aggregate.id, aggregate.toReadModel())
      }
    }

    return result
  }

  clear(): void {
    this._readModels.clear()
  }

  findById(id: string): Todo | undefined {
    return this._readModels.get(id)
  }

  list(cursor?: string, limit = 50): { items: Todo[]; nextCursor: string | null } {
    const sorted = Array.from(this._readModels.values()).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )

    let startIndex = 0
    if (cursor) {
      startIndex = sorted.findIndex((t) => t.id === cursor)
      if (startIndex === -1) startIndex = 0
      else startIndex += 1
    }

    const items = sorted.slice(startIndex, startIndex + limit)
    const hasMore = startIndex + limit < sorted.length
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null

    return { items, nextCursor }
  }
}
