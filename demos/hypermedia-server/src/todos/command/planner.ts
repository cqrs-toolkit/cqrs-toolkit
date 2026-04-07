/**
 * CommandPlanner for Todo commands.
 */

import type { TodoStatus } from '@cqrs-toolkit/demo-base/todos/shared'
import { CommandPlanner } from '@cqrs-toolkit/hypermedia/server'
import { COMMAND_ENVELOPE_EXTRACTOR } from '../../command-utils.js'
import { TodoCommandIds, TodoCommands } from './doc.js'

export type TodoMutationCommand =
  | { stableId: typeof TodoCommandIds.UpdateTodoContent; data: { content: string } }
  | { stableId: typeof TodoCommandIds.ChangeTodoStatus; data: { status: TodoStatus } }
  | { stableId: typeof TodoCommandIds.DeleteTodo; data: Record<string, never> }

export const TODO_COMMANDS = new CommandPlanner(TodoCommands, COMMAND_ENVELOPE_EXTRACTOR)
