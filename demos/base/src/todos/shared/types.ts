/**
 * Todo entity and query response types.
 */

export type TodoStatus = 'pending' | 'in_progress' | 'completed'

export interface Todo {
  readonly id: string
  readonly content: string
  readonly status: TodoStatus
  readonly createdAt: string
  readonly updatedAt: string
  readonly latestRevision?: string | undefined
}

export interface ListTodosResponse {
  readonly items: Todo[]
  readonly nextCursor: string | null
}
