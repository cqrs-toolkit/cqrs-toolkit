/**
 * Notebook aggregate — server-side event sourcing with AggregateRoot.
 */

import type {
  Notebook,
  NotebookCreatedEvent,
  NotebookDeletedEvent,
  NotebookNameUpdatedEvent,
} from '@cqrs-toolkit/demo-base/notebooks/shared'
import { AggregateRoot, type EventMetadata, type IEvent, createEvent } from '@meticoeus/ddd-es'
import assert from 'node:assert'

export type NotebookServerEvent =
  | IEvent<'NotebookCreated', NotebookCreatedEvent['data'], EventMetadata>
  | IEvent<'NotebookNameUpdated', NotebookNameUpdatedEvent['data'], EventMetadata>
  | IEvent<'NotebookDeleted', NotebookDeletedEvent['data'], EventMetadata>

export class NotebookAggregate extends AggregateRoot<NotebookServerEvent> {
  private _name = ''
  private _createdAt = ''
  private _updatedAt = ''

  constructor() {
    super()
  }

  static getStreamName(id: string): string {
    return `Notebook-${id}`
  }

  create(data: { name: string }, id: string, metadata: EventMetadata): void {
    const now = new Date().toISOString()
    this.applyChange(
      createEvent<NotebookServerEvent>({
        type: 'NotebookCreated',
        data: { id, name: data.name, createdAt: now },
        metadata,
      }),
    )
  }

  updateName(data: { name: string }, metadata: EventMetadata): void {
    this.applyChange(
      createEvent<NotebookServerEvent>({
        type: 'NotebookNameUpdated',
        data: { id: this._id, name: data.name, updatedAt: new Date().toISOString() },
        metadata,
      }),
    )
  }

  markDeleted(metadata: EventMetadata): void {
    this.applyChange(
      createEvent<NotebookServerEvent>({
        type: 'NotebookDeleted',
        data: { id: this._id },
        metadata,
      }),
    )
  }

  toReadModel(): Notebook {
    assert(
      typeof this.revision === 'bigint',
      'toReadModel() called before save — revision is not set',
    )
    return {
      id: this._id,
      name: this._name,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      latestRevision: String(this.revision),
    }
  }

  // --- Event appliers ---

  private applyNotebookCreated(
    event: IEvent<'NotebookCreated', NotebookCreatedEvent['data']>,
  ): void {
    this._id = event.data.id
    this._name = event.data.name
    this._createdAt = event.data.createdAt
    this._updatedAt = event.data.createdAt
  }

  private applyNotebookNameUpdated(
    event: IEvent<'NotebookNameUpdated', NotebookNameUpdatedEvent['data']>,
  ): void {
    this._name = event.data.name
    this._updatedAt = event.data.updatedAt
  }

  private applyNotebookDeleted(
    _event: IEvent<'NotebookDeleted', NotebookDeletedEvent['data']>,
  ): void {
    this._deleted = true
  }
}
