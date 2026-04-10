/**
 * Todo base type and shared enums.
 */

export type TodoStatus = 'pending' | 'in_progress' | 'completed'

export interface TodoBase {
  readonly content: string
  readonly status: TodoStatus
  readonly createdAt: string
  readonly updatedAt: string
  readonly latestRevision?: string | undefined
}
