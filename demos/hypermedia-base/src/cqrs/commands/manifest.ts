/**
 * Generated command routing manifest — do not edit.
 * Regenerate with: cqrs-toolkit client pull
 */

import type { AutoRevision, EntityId } from '@cqrs-toolkit/client'
import type { CommandManifest } from '@cqrs-toolkit/hypermedia-client'
import type {
  NbAddNotebookTagV1_0_0,
  NbChangeTodoStatusV1_0_0,
  NbCreateNoteV1_0_0,
  NbCreateNotebookV1_0_0,
  NbCreateTodoV1_0_0,
  NbDeleteNoteV1_0_0,
  NbDeleteNotebookV1_0_0,
  NbDeleteTodoV1_0_0,
  NbRemoveNotebookTagV1_0_0,
  NbUpdateNoteBodyV1_0_0,
  NbUpdateNoteTitleV1_0_0,
  NbUpdateNotebookNameV1_0_0,
  NbUpdateTodoContentV1_0_0,
  StorageCreateFileObjectV1_0_0,
  StorageDeleteFileObjectV1_0_0,
} from './types.js'

export const commands: CommandManifest = {
  commands: {
    'nb.CreateTodo': {
      urn: 'urn:command:nb.CreateTodo:1.0.0',
      dispatch: 'create',
      template: '/api/todos',
      mappings: [],
    },
    'nb.UpdateTodoContent': {
      urn: 'urn:command:nb.UpdateTodoContent:1.0.0',
      dispatch: 'command',
      commandType: 'updateContent',
      template: '/api/todos/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    'nb.ChangeTodoStatus': {
      urn: 'urn:command:nb.ChangeTodoStatus:1.0.0',
      dispatch: 'command',
      commandType: 'changeStatus',
      template: '/api/todos/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    'nb.DeleteTodo': {
      urn: 'urn:command:nb.DeleteTodo:1.0.0',
      dispatch: 'command',
      commandType: 'delete',
      template: '/api/todos/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    'nb.CreateNote': {
      urn: 'urn:command:nb.CreateNote:1.0.0',
      dispatch: 'create',
      template: '/api/notes',
      mappings: [],
    },
    'nb.UpdateNoteTitle': {
      urn: 'urn:command:nb.UpdateNoteTitle:1.0.0',
      dispatch: 'command',
      commandType: 'updateTitle',
      template: '/api/notes/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    'nb.UpdateNoteBody': {
      urn: 'urn:command:nb.UpdateNoteBody:1.0.0',
      dispatch: 'command',
      commandType: 'updateBody',
      template: '/api/notes/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    'nb.DeleteNote': {
      urn: 'urn:command:nb.DeleteNote:1.0.0',
      dispatch: 'command',
      commandType: 'delete',
      template: '/api/notes/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    'nb.CreateNotebook': {
      urn: 'urn:command:nb.CreateNotebook:1.0.0',
      dispatch: 'create',
      template: '/api/notebooks',
      mappings: [],
    },
    'nb.UpdateNotebookName': {
      urn: 'urn:command:nb.UpdateNotebookName:1.0.0',
      dispatch: 'command',
      commandType: 'updateName',
      template: '/api/notebooks/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    'nb.DeleteNotebook': {
      urn: 'urn:command:nb.DeleteNotebook:1.0.0',
      dispatch: 'command',
      commandType: 'delete',
      template: '/api/notebooks/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    'nb.AddNotebookTag': {
      urn: 'urn:command:nb.AddNotebookTag:1.0.0',
      dispatch: 'command',
      commandType: 'addTag',
      template: '/api/notebooks/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    'nb.RemoveNotebookTag': {
      urn: 'urn:command:nb.RemoveNotebookTag:1.0.0',
      dispatch: 'command',
      commandType: 'removeTag',
      template: '/api/notebooks/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    'storage.CreateFileObject': {
      urn: 'urn:command:storage.CreateFileObject:1.0.0',
      dispatch: 'create',
      template: '/api/file-objects',
      mappings: [],
      responseSchema: [
        {
          contentType: 'application/json',
          schemaUrl:
            'http://localhost:3002/api/meta/schemas/urn/schema/storage.PresignedPermitResponse/1.0.0.json',
        },
      ],
      workflow: { type: 'svc:PresignedPostUpload', nextStepId: 'svc:S3FormPost' },
    },
    'storage.DeleteFileObject': {
      urn: 'urn:command:storage.DeleteFileObject:1.0.0',
      dispatch: 'command',
      commandType: 'delete',
      template: '/api/file-objects/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
  },
}

export type AppCommand =
  | { type: 'nb.CreateTodo'; data: NbCreateTodoV1_0_0 }
  | {
      type: 'nb.UpdateTodoContent'
      path: { id: EntityId }
      data: NbUpdateTodoContentV1_0_0
      revision?: string | AutoRevision
    }
  | {
      type: 'nb.ChangeTodoStatus'
      path: { id: EntityId }
      data: NbChangeTodoStatusV1_0_0
      revision?: string | AutoRevision
    }
  | {
      type: 'nb.DeleteTodo'
      path: { id: EntityId }
      data: NbDeleteTodoV1_0_0
      revision?: string | AutoRevision
    }
  | { type: 'nb.CreateNote'; data: NbCreateNoteV1_0_0 }
  | {
      type: 'nb.UpdateNoteTitle'
      path: { id: EntityId }
      data: NbUpdateNoteTitleV1_0_0
      revision?: string | AutoRevision
    }
  | {
      type: 'nb.UpdateNoteBody'
      path: { id: EntityId }
      data: NbUpdateNoteBodyV1_0_0
      revision?: string | AutoRevision
    }
  | {
      type: 'nb.DeleteNote'
      path: { id: EntityId }
      data: NbDeleteNoteV1_0_0
      revision?: string | AutoRevision
    }
  | { type: 'nb.CreateNotebook'; data: NbCreateNotebookV1_0_0 }
  | {
      type: 'nb.UpdateNotebookName'
      path: { id: EntityId }
      data: NbUpdateNotebookNameV1_0_0
      revision?: string | AutoRevision
    }
  | {
      type: 'nb.DeleteNotebook'
      path: { id: EntityId }
      data: NbDeleteNotebookV1_0_0
      revision?: string | AutoRevision
    }
  | {
      type: 'nb.AddNotebookTag'
      path: { id: EntityId }
      data: NbAddNotebookTagV1_0_0
      revision?: string | AutoRevision
    }
  | {
      type: 'nb.RemoveNotebookTag'
      path: { id: EntityId }
      data: NbRemoveNotebookTagV1_0_0
      revision?: string | AutoRevision
    }
  | { type: 'storage.CreateFileObject'; data: StorageCreateFileObjectV1_0_0; files: [File] }
  | {
      type: 'storage.DeleteFileObject'
      path: { id: EntityId }
      data: StorageDeleteFileObjectV1_0_0
      revision?: string | AutoRevision
    }
