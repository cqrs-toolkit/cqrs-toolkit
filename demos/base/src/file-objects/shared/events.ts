/**
 * FileObject event types and event union.
 */

export type FileObjectEventType = 'FileObjectCreated' | 'FileObjectDeleted'

export type FileObjectEvent = FileObjectCreatedEvent | FileObjectDeletedEvent

export interface FileObjectCreatedEvent {
  readonly type: 'FileObjectCreated'
  readonly data: {
    readonly id: string
    readonly noteId: string
    readonly name: string
    readonly contentType: string
    readonly resource: string
    readonly size: number
    readonly createdAt: string
  }
}

export interface FileObjectDeletedEvent {
  readonly type: 'FileObjectDeleted'
  readonly data: {
    readonly id: string
  }
}
