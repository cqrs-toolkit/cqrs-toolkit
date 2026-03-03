/**
 * Note event types and event union.
 */

export type NoteEventType = 'NoteCreated' | 'NoteTitleUpdated' | 'NoteBodyUpdated' | 'NoteDeleted'

export type NoteEvent =
  | NoteCreatedEvent
  | NoteTitleUpdatedEvent
  | NoteBodyUpdatedEvent
  | NoteDeletedEvent

export interface NoteCreatedEvent {
  readonly type: 'NoteCreated'
  readonly data: {
    readonly id: string
    readonly title: string
    readonly body: string
    readonly createdAt: string
  }
}

export interface NoteTitleUpdatedEvent {
  readonly type: 'NoteTitleUpdated'
  readonly data: {
    readonly id: string
    readonly title: string
    readonly updatedAt: string
  }
}

export interface NoteBodyUpdatedEvent {
  readonly type: 'NoteBodyUpdated'
  readonly data: {
    readonly id: string
    readonly body: string
    readonly updatedAt: string
  }
}

export interface NoteDeletedEvent {
  readonly type: 'NoteDeleted'
  readonly data: {
    readonly id: string
  }
}
