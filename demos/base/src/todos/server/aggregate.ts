/**
 * Todo aggregate — server-side event sourcing with AggregateRoot.
 */

import { AggregateRoot, type EventMetadata, type IEvent, createEvent } from '@meticoeus/ddd-es'
import assert from 'node:assert'
import type {
  TodoContentUpdatedEvent,
  TodoCreatedEvent,
  TodoDeletedEvent,
  TodoStatus,
  TodoStatusChangedEvent,
} from '../shared/index.js'
import type { Todo } from './types.js'

export type TodoServerEvent =
  | IEvent<'TodoCreated', TodoCreatedEvent['data'], EventMetadata>
  | IEvent<'TodoContentUpdated', TodoContentUpdatedEvent['data'], EventMetadata>
  | IEvent<'TodoStatusChanged', TodoStatusChangedEvent['data'], EventMetadata>
  | IEvent<'TodoDeleted', TodoDeletedEvent['data'], EventMetadata>

export class TodoAggregate extends AggregateRoot<TodoServerEvent> {
  private _content = ''
  private _status: TodoStatus = 'pending'
  private _createdAt = ''
  private _updatedAt = ''

  constructor() {
    super()
  }

  static getStreamName(id: string): string {
    return `nb.Todo-${id}`
  }

  create(data: { content: string }, id: string, metadata: EventMetadata): void {
    const now = new Date().toISOString()
    this.applyChange(
      createEvent<TodoServerEvent>({
        type: 'TodoCreated',
        data: { id, content: data.content, status: 'pending', createdAt: now },
        metadata,
      }),
    )
  }

  updateContent(data: { content: string }, metadata: EventMetadata): void {
    this.applyChange(
      createEvent<TodoServerEvent>({
        type: 'TodoContentUpdated',
        data: { id: this._id, content: data.content, updatedAt: new Date().toISOString() },
        metadata,
      }),
    )
  }

  changeStatus(data: { status: TodoStatus }, metadata: EventMetadata): void {
    this.applyChange(
      createEvent<TodoServerEvent>({
        type: 'TodoStatusChanged',
        data: { id: this._id, status: data.status, updatedAt: new Date().toISOString() },
        metadata,
      }),
    )
  }

  markDeleted(metadata: EventMetadata): void {
    this.applyChange(
      createEvent<TodoServerEvent>({
        type: 'TodoDeleted',
        data: { id: this._id },
        metadata,
      }),
    )
  }

  toReadModel(): Todo {
    assert(
      typeof this.revision === 'bigint',
      'toReadModel() called before save — revision is not set',
    )
    return {
      id: this._id,
      content: this._content,
      status: this._status,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      latestRevision: String(this.revision),
    }
  }

  // --- Event appliers ---

  private applyTodoCreated(event: IEvent<'TodoCreated', TodoCreatedEvent['data']>): void {
    this._id = event.data.id
    this._content = event.data.content
    this._status = event.data.status
    this._createdAt = event.data.createdAt
    this._updatedAt = event.data.createdAt
  }

  private applyTodoContentUpdated(
    event: IEvent<'TodoContentUpdated', TodoContentUpdatedEvent['data']>,
  ): void {
    this._content = event.data.content
    this._updatedAt = event.data.updatedAt
  }

  private applyTodoStatusChanged(
    event: IEvent<'TodoStatusChanged', TodoStatusChangedEvent['data']>,
  ): void {
    this._status = event.data.status
    this._updatedAt = event.data.updatedAt
  }

  private applyTodoDeleted(_event: IEvent<'TodoDeleted', TodoDeletedEvent['data']>): void {
    this._deleted = true
  }
}
