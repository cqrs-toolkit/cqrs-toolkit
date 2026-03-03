/**
 * Note aggregate — server-side event sourcing with AggregateRoot.
 */

import { AggregateRoot, type EventMetadata, type IEvent, createEvent } from '@meticoeus/ddd-es'
import assert from 'node:assert'
import type {
  NoteBodyUpdatedEvent,
  NoteCreatedEvent,
  NoteDeletedEvent,
  NoteTitleUpdatedEvent,
} from '../../shared/notes/events.js'
import type { Note } from '../../shared/notes/types.js'

export type NoteServerEvent =
  | IEvent<'NoteCreated', NoteCreatedEvent['data'], EventMetadata>
  | IEvent<'NoteTitleUpdated', NoteTitleUpdatedEvent['data'], EventMetadata>
  | IEvent<'NoteBodyUpdated', NoteBodyUpdatedEvent['data'], EventMetadata>
  | IEvent<'NoteDeleted', NoteDeletedEvent['data'], EventMetadata>

export class NoteAggregate extends AggregateRoot<NoteServerEvent> {
  private _title = ''
  private _body = ''
  private _createdAt = ''
  private _updatedAt = ''

  constructor() {
    super()
  }

  static getStreamName(id: string): string {
    return `Note-${id}`
  }

  create(payload: { title: string; body: string }, id: string, metadata: EventMetadata): void {
    const now = new Date().toISOString()
    this.applyChange(
      createEvent<NoteServerEvent>({
        type: 'NoteCreated',
        data: { id, title: payload.title, body: payload.body, createdAt: now },
        metadata,
      }),
    )
  }

  updateTitle(payload: { title: string }, metadata: EventMetadata): void {
    this.applyChange(
      createEvent<NoteServerEvent>({
        type: 'NoteTitleUpdated',
        data: { id: this._id, title: payload.title, updatedAt: new Date().toISOString() },
        metadata,
      }),
    )
  }

  updateBody(payload: { body: string }, metadata: EventMetadata): void {
    this.applyChange(
      createEvent<NoteServerEvent>({
        type: 'NoteBodyUpdated',
        data: { id: this._id, body: payload.body, updatedAt: new Date().toISOString() },
        metadata,
      }),
    )
  }

  markDeleted(metadata: EventMetadata): void {
    this.applyChange(
      createEvent<NoteServerEvent>({
        type: 'NoteDeleted',
        data: { id: this._id },
        metadata,
      }),
    )
  }

  toReadModel(): Note {
    assert(
      typeof this.revision === 'bigint',
      'toReadModel() called before save — revision is not set',
    )
    return {
      id: this._id,
      title: this._title,
      body: this._body,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      latestRevision: String(this.revision),
    }
  }

  // --- Event appliers ---

  private applyNoteCreated(event: IEvent<'NoteCreated', NoteCreatedEvent['data']>): void {
    this._id = event.data.id
    this._title = event.data.title
    this._body = event.data.body
    this._createdAt = event.data.createdAt
    this._updatedAt = event.data.createdAt
  }

  private applyNoteTitleUpdated(
    event: IEvent<'NoteTitleUpdated', NoteTitleUpdatedEvent['data']>,
  ): void {
    this._title = event.data.title
    this._updatedAt = event.data.updatedAt
  }

  private applyNoteBodyUpdated(
    event: IEvent<'NoteBodyUpdated', NoteBodyUpdatedEvent['data']>,
  ): void {
    this._body = event.data.body
    this._updatedAt = event.data.updatedAt
  }

  private applyNoteDeleted(_event: IEvent<'NoteDeleted', NoteDeletedEvent['data']>): void {
    this._deleted = true
  }
}
