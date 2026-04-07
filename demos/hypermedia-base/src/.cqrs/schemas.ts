/**
 * Generated schema imports — do not edit.
 * Regenerate with: cqrs-pull generate
 */

import type { SchemaRegistry } from '@cqrs-toolkit/hypermedia-client'
import type { JSONSchema7 } from 'json-schema'
import nb_AddNotebookTag from './schemas/nb.AddNotebookTag.json' with { type: 'json' }
import nb_ChangeTodoStatus from './schemas/nb.ChangeTodoStatus.json' with { type: 'json' }
import nb_CreateNote from './schemas/nb.CreateNote.json' with { type: 'json' }
import nb_CreateNotebook from './schemas/nb.CreateNotebook.json' with { type: 'json' }
import nb_CreateTodo from './schemas/nb.CreateTodo.json' with { type: 'json' }
import nb_DeleteNote from './schemas/nb.DeleteNote.json' with { type: 'json' }
import nb_DeleteNotebook from './schemas/nb.DeleteNotebook.json' with { type: 'json' }
import nb_DeleteTodo from './schemas/nb.DeleteTodo.json' with { type: 'json' }
import nb_RemoveNotebookTag from './schemas/nb.RemoveNotebookTag.json' with { type: 'json' }
import nb_UpdateNoteBody from './schemas/nb.UpdateNoteBody.json' with { type: 'json' }
import nb_UpdateNotebookName from './schemas/nb.UpdateNotebookName.json' with { type: 'json' }
import nb_UpdateNoteTitle from './schemas/nb.UpdateNoteTitle.json' with { type: 'json' }
import nb_UpdateTodoContent from './schemas/nb.UpdateTodoContent.json' with { type: 'json' }
import storage_CreateFileObject from './schemas/storage.CreateFileObject.json' with { type: 'json' }
import storage_DeleteFileObject from './schemas/storage.DeleteFileObject.json' with { type: 'json' }

export const schemas: SchemaRegistry = {
  commands: {
    'nb.CreateTodo': nb_CreateTodo as JSONSchema7,
    'nb.UpdateTodoContent': nb_UpdateTodoContent as JSONSchema7,
    'nb.ChangeTodoStatus': nb_ChangeTodoStatus as JSONSchema7,
    'nb.DeleteTodo': nb_DeleteTodo as JSONSchema7,
    'nb.CreateNote': nb_CreateNote as JSONSchema7,
    'nb.UpdateNoteTitle': nb_UpdateNoteTitle as JSONSchema7,
    'nb.UpdateNoteBody': nb_UpdateNoteBody as JSONSchema7,
    'nb.DeleteNote': nb_DeleteNote as JSONSchema7,
    'nb.CreateNotebook': nb_CreateNotebook as JSONSchema7,
    'nb.UpdateNotebookName': nb_UpdateNotebookName as JSONSchema7,
    'nb.DeleteNotebook': nb_DeleteNotebook as JSONSchema7,
    'nb.AddNotebookTag': nb_AddNotebookTag as JSONSchema7,
    'nb.RemoveNotebookTag': nb_RemoveNotebookTag as JSONSchema7,
    'storage.CreateFileObject': storage_CreateFileObject as JSONSchema7,
    'storage.DeleteFileObject': storage_DeleteFileObject as JSONSchema7,
  },
  common: {},
}
