/**
 * Generated command routing manifest — do not edit.
 * Regenerate with: cqrs-pull generate
 */

import type { AutoRevision, EntityId } from '@cqrs-toolkit/client'
import type { CommandManifest } from '@cqrs-toolkit/hypermedia-client'

export const commands: CommandManifest = {
  commands: {
    'nb.CreateTodo': {
      urn: 'urn:command:nb.CreateTodo:1.0.0',
      dispatch: 'create',
      template: '/api/todos',
      mappings: [],
      responseSchema: [
        {
          contentType: 'application/json',
          schemaUrl:
            'http://localhost:3002/api/meta/schemas/urn/schema/svc.CommandSuccessResponse/1.0.0.json',
        },
      ],
    },
    'nb.UpdateTodoContent': {
      urn: 'urn:command:nb.UpdateTodoContent:1.0.0',
      dispatch: 'command',
      commandType: 'updateContent',
      template: '/api/todos/{id}/command',
      mappings: [{ variable: 'id', required: true }],
      responseSchema: [
        {
          contentType: 'application/json',
          schemaUrl:
            'http://localhost:3002/api/meta/schemas/urn/schema/svc.CommandSuccessResponse/1.0.0.json',
        },
      ],
    },
    'nb.ChangeTodoStatus': {
      urn: 'urn:command:nb.ChangeTodoStatus:1.0.0',
      dispatch: 'command',
      commandType: 'changeStatus',
      template: '/api/todos/{id}/command',
      mappings: [{ variable: 'id', required: true }],
      responseSchema: [
        {
          contentType: 'application/json',
          schemaUrl:
            'http://localhost:3002/api/meta/schemas/urn/schema/svc.CommandSuccessResponse/1.0.0.json',
        },
      ],
    },
    'nb.DeleteTodo': {
      urn: 'urn:command:nb.DeleteTodo:1.0.0',
      dispatch: 'command',
      commandType: 'delete',
      template: '/api/todos/{id}/command',
      mappings: [{ variable: 'id', required: true }],
      responseSchema: [
        {
          contentType: 'application/json',
          schemaUrl:
            'http://localhost:3002/api/meta/schemas/urn/schema/svc.CommandSuccessResponse/1.0.0.json',
        },
      ],
    },
    'nb.CreateNote': {
      urn: 'urn:command:nb.CreateNote:1.0.0',
      dispatch: 'create',
      template: '/api/notes',
      mappings: [],
      responseSchema: [
        {
          contentType: 'application/json',
          schemaUrl:
            'http://localhost:3002/api/meta/schemas/urn/schema/svc.CommandSuccessResponse/1.0.0.json',
        },
      ],
    },
    'nb.UpdateNoteTitle': {
      urn: 'urn:command:nb.UpdateNoteTitle:1.0.0',
      dispatch: 'command',
      commandType: 'updateTitle',
      template: '/api/notes/{id}/command',
      mappings: [{ variable: 'id', required: true }],
      responseSchema: [
        {
          contentType: 'application/json',
          schemaUrl:
            'http://localhost:3002/api/meta/schemas/urn/schema/svc.CommandSuccessResponse/1.0.0.json',
        },
      ],
    },
    'nb.UpdateNoteBody': {
      urn: 'urn:command:nb.UpdateNoteBody:1.0.0',
      dispatch: 'command',
      commandType: 'updateBody',
      template: '/api/notes/{id}/command',
      mappings: [{ variable: 'id', required: true }],
      responseSchema: [
        {
          contentType: 'application/json',
          schemaUrl:
            'http://localhost:3002/api/meta/schemas/urn/schema/svc.CommandSuccessResponse/1.0.0.json',
        },
      ],
    },
    'nb.DeleteNote': {
      urn: 'urn:command:nb.DeleteNote:1.0.0',
      dispatch: 'command',
      commandType: 'delete',
      template: '/api/notes/{id}/command',
      mappings: [{ variable: 'id', required: true }],
      responseSchema: [
        {
          contentType: 'application/json',
          schemaUrl:
            'http://localhost:3002/api/meta/schemas/urn/schema/svc.CommandSuccessResponse/1.0.0.json',
        },
      ],
    },
    'nb.CreateNotebook': {
      urn: 'urn:command:nb.CreateNotebook:1.0.0',
      dispatch: 'create',
      template: '/api/notebooks',
      mappings: [],
      responseSchema: [
        {
          contentType: 'application/json',
          schemaUrl:
            'http://localhost:3002/api/meta/schemas/urn/schema/svc.CommandSuccessResponse/1.0.0.json',
        },
      ],
    },
    'nb.UpdateNotebookName': {
      urn: 'urn:command:nb.UpdateNotebookName:1.0.0',
      dispatch: 'command',
      commandType: 'updateName',
      template: '/api/notebooks/{id}/command',
      mappings: [{ variable: 'id', required: true }],
      responseSchema: [
        {
          contentType: 'application/json',
          schemaUrl:
            'http://localhost:3002/api/meta/schemas/urn/schema/svc.CommandSuccessResponse/1.0.0.json',
        },
      ],
    },
    'nb.DeleteNotebook': {
      urn: 'urn:command:nb.DeleteNotebook:1.0.0',
      dispatch: 'command',
      commandType: 'delete',
      template: '/api/notebooks/{id}/command',
      mappings: [{ variable: 'id', required: true }],
      responseSchema: [
        {
          contentType: 'application/json',
          schemaUrl:
            'http://localhost:3002/api/meta/schemas/urn/schema/svc.CommandSuccessResponse/1.0.0.json',
        },
      ],
    },
    'nb.AddNotebookTag': {
      urn: 'urn:command:nb.AddNotebookTag:1.0.0',
      dispatch: 'command',
      commandType: 'addTag',
      template: '/api/notebooks/{id}/command',
      mappings: [{ variable: 'id', required: true }],
      responseSchema: [
        {
          contentType: 'application/json',
          schemaUrl:
            'http://localhost:3002/api/meta/schemas/urn/schema/svc.CommandSuccessResponse/1.0.0.json',
        },
      ],
    },
    'nb.RemoveNotebookTag': {
      urn: 'urn:command:nb.RemoveNotebookTag:1.0.0',
      dispatch: 'command',
      commandType: 'removeTag',
      template: '/api/notebooks/{id}/command',
      mappings: [{ variable: 'id', required: true }],
      responseSchema: [
        {
          contentType: 'application/json',
          schemaUrl:
            'http://localhost:3002/api/meta/schemas/urn/schema/svc.CommandSuccessResponse/1.0.0.json',
        },
      ],
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
      responseSchema: [
        {
          contentType: 'application/json',
          schemaUrl:
            'http://localhost:3002/api/meta/schemas/urn/schema/svc.CommandSuccessResponse/1.0.0.json',
        },
      ],
    },
  },
}

export type AppCommand =
  | { type: 'nb.CreateTodo'; data: unknown }
  | {
      type: 'nb.UpdateTodoContent'
      path: { id: EntityId }
      data: unknown
      revision?: string | AutoRevision
    }
  | {
      type: 'nb.ChangeTodoStatus'
      path: { id: EntityId }
      data: unknown
      revision?: string | AutoRevision
    }
  | {
      type: 'nb.DeleteTodo'
      path: { id: EntityId }
      data: unknown
      revision?: string | AutoRevision
    }
  | { type: 'nb.CreateNote'; data: unknown }
  | {
      type: 'nb.UpdateNoteTitle'
      path: { id: EntityId }
      data: unknown
      revision?: string | AutoRevision
    }
  | {
      type: 'nb.UpdateNoteBody'
      path: { id: EntityId }
      data: unknown
      revision?: string | AutoRevision
    }
  | {
      type: 'nb.DeleteNote'
      path: { id: EntityId }
      data: unknown
      revision?: string | AutoRevision
    }
  | { type: 'nb.CreateNotebook'; data: unknown }
  | {
      type: 'nb.UpdateNotebookName'
      path: { id: EntityId }
      data: unknown
      revision?: string | AutoRevision
    }
  | {
      type: 'nb.DeleteNotebook'
      path: { id: EntityId }
      data: unknown
      revision?: string | AutoRevision
    }
  | {
      type: 'nb.AddNotebookTag'
      path: { id: EntityId }
      data: unknown
      revision?: string | AutoRevision
    }
  | {
      type: 'nb.RemoveNotebookTag'
      path: { id: EntityId }
      data: unknown
      revision?: string | AutoRevision
    }
  | { type: 'storage.CreateFileObject'; data: unknown; files: [File] }
  | {
      type: 'storage.DeleteFileObject'
      path: { id: EntityId }
      data: unknown
      revision?: string | AutoRevision
    }
