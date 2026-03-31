/**
 * FileObject command planner — validates and dispatches commands.
 */

import { CommandPlanner } from '@cqrs-toolkit/hypermedia/server'
import { COMMAND_ENVELOPE_EXTRACTOR } from '../../command-utils.js'
import { FileObjectCommandIds, FileObjectCommands } from './doc.js'

export type FileObjectMutationCommand = {
  stableId: typeof FileObjectCommandIds.DeleteFileObject
  data: Record<string, never>
}

export const FILE_OBJECT_COMMANDS = new CommandPlanner(
  FileObjectCommands,
  COMMAND_ENVELOPE_EXTRACTOR,
)
