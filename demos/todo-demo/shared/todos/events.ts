/**
 * Todo event types and event union.
 */

export type TodoEventType =
  | 'TodoCreated'
  | 'TodoContentUpdated'
  | 'TodoStatusChanged'
  | 'TodoDeleted'

export type TodoEvent =
  | TodoCreatedEvent
  | TodoContentUpdatedEvent
  | TodoStatusChangedEvent
  | TodoDeletedEvent

export interface TodoCreatedEvent {
  readonly type: 'TodoCreated'
  readonly data: {
    readonly id: string
    readonly content: string
    readonly status: 'pending'
    readonly createdAt: string
  }
}

export interface TodoContentUpdatedEvent {
  readonly type: 'TodoContentUpdated'
  readonly data: {
    readonly id: string
    readonly content: string
    readonly updatedAt: string
  }
}

export interface TodoStatusChangedEvent {
  readonly type: 'TodoStatusChanged'
  readonly data: {
    readonly id: string
    readonly status: import('./types.js').TodoStatus
    readonly updatedAt: string
  }
}

export interface TodoDeletedEvent {
  readonly type: 'TodoDeleted'
  readonly data: {
    readonly id: string
  }
}
