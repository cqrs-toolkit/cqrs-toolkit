/**
 * Notebook event types and event union.
 */

export type NotebookEventType = 'NotebookCreated' | 'NotebookNameUpdated' | 'NotebookDeleted'

export type NotebookEvent = NotebookCreatedEvent | NotebookNameUpdatedEvent | NotebookDeletedEvent

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
