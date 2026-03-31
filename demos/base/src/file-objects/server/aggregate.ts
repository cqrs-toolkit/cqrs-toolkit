/**
 * FileObject aggregate — server-side event sourcing with AggregateRoot.
 */

import type {
  FileObject,
  FileObjectCreatedEvent,
  FileObjectDeletedEvent,
} from '@cqrs-toolkit/demo-base/file-objects/shared'
import { AggregateRoot, type EventMetadata, type IEvent, createEvent } from '@meticoeus/ddd-es'
import assert from 'node:assert'

export type FileObjectServerEvent =
  | IEvent<'FileObjectCreated', FileObjectCreatedEvent['data'], EventMetadata>
  | IEvent<'FileObjectDeleted', FileObjectDeletedEvent['data'], EventMetadata>

export class FileObjectAggregate extends AggregateRoot<FileObjectServerEvent> {
  private _noteId = ''
  private _name = ''
  private _contentType = ''
  private _resource = ''
  private _size = 0
  private _createdAt = ''

  get noteId(): string {
    return this._noteId
  }

  constructor() {
    super()
  }

  static getStreamName(id: string): string {
    return `FileObject-${id}`
  }

  create(
    data: { noteId: string; name: string; contentType: string; resource: string; size: number },
    id: string,
    metadata: EventMetadata,
  ): void {
    const now = new Date().toISOString()
    this.applyChange(
      createEvent<FileObjectServerEvent>({
        type: 'FileObjectCreated',
        data: {
          id,
          noteId: data.noteId,
          name: data.name,
          contentType: data.contentType,
          resource: data.resource,
          size: data.size,
          createdAt: now,
        },
        metadata,
      }),
    )
  }

  markDeleted(metadata: EventMetadata): void {
    this.applyChange(
      createEvent<FileObjectServerEvent>({
        type: 'FileObjectDeleted',
        data: { id: this._id },
        metadata,
      }),
    )
  }

  toReadModel(notebookId: string): FileObject {
    assert(
      typeof this.revision === 'bigint',
      'toReadModel() called before save — revision is not set',
    )
    return {
      id: this._id,
      noteId: this._noteId,
      notebookId,
      name: this._name,
      contentType: this._contentType,
      resource: this._resource,
      size: this._size,
      createdAt: this._createdAt,
      latestRevision: String(this.revision),
    }
  }

  // --- Event appliers ---

  private applyFileObjectCreated(
    event: IEvent<'FileObjectCreated', FileObjectCreatedEvent['data']>,
  ): void {
    this._id = event.data.id
    this._noteId = event.data.noteId
    this._name = event.data.name
    this._contentType = event.data.contentType
    this._resource = event.data.resource
    this._size = event.data.size
    this._createdAt = event.data.createdAt
  }

  private applyFileObjectDeleted(
    _event: IEvent<'FileObjectDeleted', FileObjectDeletedEvent['data']>,
  ): void {
    this._deleted = true
  }
}
