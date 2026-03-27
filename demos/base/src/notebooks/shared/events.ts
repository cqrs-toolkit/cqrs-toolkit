/**
 * Notebook event types and event union.
 */

export type NotebookEventType =
  | 'NotebookCreated'
  | 'NotebookNameUpdated'
  | 'NotebookDeleted'
  | 'NotebookTagAdded'
  | 'NotebookTagRemoved'

export type NotebookEvent =
  | NotebookCreatedEvent
  | NotebookNameUpdatedEvent
  | NotebookDeletedEvent
  | NotebookTagAddedEvent
  | NotebookTagRemovedEvent

export interface NotebookCreatedEvent {
  readonly type: 'NotebookCreated'
  readonly data: {
    readonly id: string
    readonly name: string
    readonly createdAt: string
  }
}

export interface NotebookNameUpdatedEvent {
  readonly type: 'NotebookNameUpdated'
  readonly data: {
    readonly id: string
    readonly name: string
    readonly updatedAt: string
  }
}

export interface NotebookDeletedEvent {
  readonly type: 'NotebookDeleted'
  readonly data: {
    readonly id: string
  }
}

export interface NotebookTagAddedEvent {
  readonly type: 'NotebookTagAdded'
  readonly data: {
    readonly id: string
    readonly tag: string
  }
}

export interface NotebookTagRemovedEvent {
  readonly type: 'NotebookTagRemoved'
  readonly data: {
    readonly id: string
    readonly tag: string
  }
}
