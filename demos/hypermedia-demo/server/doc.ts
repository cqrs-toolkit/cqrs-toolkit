/**
 * Top-level Hydra API documentation assembly.
 */

import type { HydraDoc } from '@cqrs-toolkit/hypermedia'
import { FileObjectCommands } from './file-objects/command/doc.js'
import { FileObjectRepV1_0_0 } from './file-objects/query/v1_0_0/representation.js'
import { NotebookCommands } from './notebooks/command/doc.js'
import { NotebookRepV1_0_0 } from './notebooks/query/v1_0_0/representation.js'
import { NoteCommands } from './notes/command/doc.js'
import { NoteRepV1_0_0 } from './notes/query/v1_0_0/representation.js'
import { TodoCommands } from './todos/command/doc.js'
import { TodoRepV1_0_0 } from './todos/query/v1_0_0/representation.js'

export const HydraDemoClasses: HydraDoc.ClassDef[] = [
  { class: 'nb:Todo', commands: TodoCommands, representations: [TodoRepV1_0_0] },
  { class: 'nb:Note', commands: NoteCommands, representations: [NoteRepV1_0_0] },
  { class: 'nb:Notebook', commands: NotebookCommands, representations: [NotebookRepV1_0_0] },
  {
    class: 'storage:FileObject',
    commands: FileObjectCommands,
    representations: [FileObjectRepV1_0_0],
  },
]
