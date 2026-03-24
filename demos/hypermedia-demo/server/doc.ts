/**
 * Top-level Hydra API documentation assembly.
 */

import type { HydraDoc } from '@cqrs-toolkit/hypermedia'
import { NotebookCommands } from './notebooks/command/doc.js'
import { NotebookRepV1_0_0 } from './notebooks/query/v1_0_0/representation.js'
import { NoteCommands } from './notes/command/doc.js'
import { NoteRepV1_0_0 } from './notes/query/v1_0_0/representation.js'
import { TodoCommands } from './todos/command/doc.js'
import { TodoRepV1_0_0 } from './todos/query/v1_0_0/representation.js'

export const HydraDemoClasses: HydraDoc.ClassDef[] = [
  { class: 'demo:Todo', commands: TodoCommands, representations: [TodoRepV1_0_0] },
  { class: 'demo:Note', commands: NoteCommands, representations: [NoteRepV1_0_0] },
  { class: 'demo:Notebook', commands: NotebookCommands, representations: [NotebookRepV1_0_0] },
]
