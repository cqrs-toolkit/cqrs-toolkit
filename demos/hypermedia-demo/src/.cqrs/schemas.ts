/**
 * Generated schema imports — do not edit.
 * Regenerate with: cqrs-pull generate
 */

import type { SchemaRegistry } from '@cqrs-toolkit/hypermedia-client'
import type { JSONSchema7 } from 'json-schema'
import ChangeTodoStatus from './schemas/ChangeTodoStatus.json' with { type: 'json' }
import CreateNote from './schemas/CreateNote.json' with { type: 'json' }
import CreateNotebook from './schemas/CreateNotebook.json' with { type: 'json' }
import CreateTodo from './schemas/CreateTodo.json' with { type: 'json' }
import DeleteNote from './schemas/DeleteNote.json' with { type: 'json' }
import DeleteNotebook from './schemas/DeleteNotebook.json' with { type: 'json' }
import DeleteTodo from './schemas/DeleteTodo.json' with { type: 'json' }
import UpdateNoteBody from './schemas/UpdateNoteBody.json' with { type: 'json' }
import UpdateNotebookName from './schemas/UpdateNotebookName.json' with { type: 'json' }
import UpdateNoteTitle from './schemas/UpdateNoteTitle.json' with { type: 'json' }
import UpdateTodoContent from './schemas/UpdateTodoContent.json' with { type: 'json' }

export const schemas: SchemaRegistry = {
  commands: {
    CreateTodo: CreateTodo as JSONSchema7,
    UpdateTodoContent: UpdateTodoContent as JSONSchema7,
    ChangeTodoStatus: ChangeTodoStatus as JSONSchema7,
    DeleteTodo: DeleteTodo as JSONSchema7,
    CreateNote: CreateNote as JSONSchema7,
    UpdateNoteTitle: UpdateNoteTitle as JSONSchema7,
    UpdateNoteBody: UpdateNoteBody as JSONSchema7,
    DeleteNote: DeleteNote as JSONSchema7,
    CreateNotebook: CreateNotebook as JSONSchema7,
    UpdateNotebookName: UpdateNotebookName as JSONSchema7,
    DeleteNotebook: DeleteNotebook as JSONSchema7,
  },
  common: {},
}
