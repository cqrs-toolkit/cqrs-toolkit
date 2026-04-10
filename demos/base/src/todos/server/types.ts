import type { TodoBase } from '../shared/index.js'

export interface Todo extends TodoBase {
  readonly id: string
}

export interface ListTodosResponse {
  readonly items: Todo[]
  readonly nextCursor: string | null
}
