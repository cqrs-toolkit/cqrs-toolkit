/**
 * CommandPlanner for Note commands.
 */

import { CommandPlanner } from '@cqrs-toolkit/hypermedia/server'
import { COMMAND_ENVELOPE_EXTRACTOR } from '../../command-utils.js'
import { NoteCommandIds, NoteCommands } from './doc.js'

export type NoteMutationCommand =
  | { stableId: typeof NoteCommandIds.UpdateNoteTitle; data: { title: string } }
  | { stableId: typeof NoteCommandIds.UpdateNoteBody; data: { body: string } }
  | { stableId: typeof NoteCommandIds.DeleteNote; data: Record<string, never> }

export const NOTE_COMMANDS = new CommandPlanner(NoteCommands, COMMAND_ENVELOPE_EXTRACTOR)
