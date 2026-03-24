/**
 * Generated command routing manifest — do not edit.
 * Regenerate with: cqrs-pull generate
 */

import type { AutoRevision } from '@cqrs-toolkit/client'
import type { CommandManifest } from '@cqrs-toolkit/hypermedia-client'

export const commands: CommandManifest = {
  commands: {
    CreateTodo: {
      urn: 'urn:command:demo.CreateTodo:1.0.0',
      dispatch: 'create',
      template: '/api/todos',
      mappings: [],
    },
    UpdateTodoContent: {
      urn: 'urn:command:demo.UpdateTodoContent:1.0.0',
      dispatch: 'command',
      commandType: 'updateContent',
      template: '/api/todos/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    ChangeTodoStatus: {
      urn: 'urn:command:demo.ChangeTodoStatus:1.0.0',
      dispatch: 'command',
      commandType: 'changeStatus',
      template: '/api/todos/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    DeleteTodo: {
      urn: 'urn:command:demo.DeleteTodo:1.0.0',
      dispatch: 'command',
      commandType: 'delete',
      template: '/api/todos/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    CreateNote: {
      urn: 'urn:command:demo.CreateNote:1.0.0',
      dispatch: 'create',
      template: '/api/notes',
      mappings: [],
    },
    UpdateNoteTitle: {
      urn: 'urn:command:demo.UpdateNoteTitle:1.0.0',
      dispatch: 'command',
      commandType: 'updateTitle',
      template: '/api/notes/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    UpdateNoteBody: {
      urn: 'urn:command:demo.UpdateNoteBody:1.0.0',
      dispatch: 'command',
      commandType: 'updateBody',
      template: '/api/notes/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    DeleteNote: {
      urn: 'urn:command:demo.DeleteNote:1.0.0',
      dispatch: 'command',
      commandType: 'delete',
      template: '/api/notes/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    CreateNotebook: {
      urn: 'urn:command:demo.CreateNotebook:1.0.0',
      dispatch: 'create',
      template: '/api/notebooks',
      mappings: [],
    },
    UpdateNotebookName: {
      urn: 'urn:command:demo.UpdateNotebookName:1.0.0',
      dispatch: 'command',
      commandType: 'updateName',
      template: '/api/notebooks/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
    DeleteNotebook: {
      urn: 'urn:command:demo.DeleteNotebook:1.0.0',
      dispatch: 'command',
      commandType: 'delete',
      template: '/api/notebooks/{id}/command',
      mappings: [{ variable: 'id', required: true }],
    },
  },
}

export type AppCommand =
  | { type: 'CreateTodo'; data: unknown }
  | {
      type: 'UpdateTodoContent'
      path: { id: string }
      data: unknown
      revision?: string | AutoRevision
    }
  | {
      type: 'ChangeTodoStatus'
      path: { id: string }
      data: unknown
      revision?: string | AutoRevision
    }
  | { type: 'DeleteTodo'; path: { id: string }; data: unknown; revision?: string | AutoRevision }
  | { type: 'CreateNote'; data: unknown }
  | {
      type: 'UpdateNoteTitle'
      path: { id: string }
      data: unknown
      revision?: string | AutoRevision
    }
  | {
      type: 'UpdateNoteBody'
      path: { id: string }
      data: unknown
      revision?: string | AutoRevision
    }
  | { type: 'DeleteNote'; path: { id: string }; data: unknown; revision?: string | AutoRevision }
  | { type: 'CreateNotebook'; data: unknown }
  | {
      type: 'UpdateNotebookName'
      path: { id: string }
      data: unknown
      revision?: string | AutoRevision
    }
  | {
      type: 'DeleteNotebook'
      path: { id: string }
      data: unknown
      revision?: string | AutoRevision
    }
