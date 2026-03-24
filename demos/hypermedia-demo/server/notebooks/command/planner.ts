/**
 * CommandPlanner for Notebook commands.
 */

import { CommandPlanner } from '@cqrs-toolkit/hypermedia/server'
import { COMMAND_ENVELOPE_EXTRACTOR } from '../../command-utils.js'
import { NotebookCommandIds, NotebookCommands } from './doc.js'

export type NotebookMutationCommand =
  | { stableId: typeof NotebookCommandIds.UpdateNotebookName; data: { name: string } }
  | { stableId: typeof NotebookCommandIds.DeleteNotebook; data: Record<string, never> }

export const NOTEBOOK_COMMANDS = new CommandPlanner(NotebookCommands, COMMAND_ENVELOPE_EXTRACTOR)
