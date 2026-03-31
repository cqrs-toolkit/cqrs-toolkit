import { defineConfig } from '@cqrs-toolkit/hypermedia-client/config'
import type { JSONSchema7 } from 'json-schema'

export default defineConfig({
  server: 'http://localhost:3002',
  apidocPath: '/api/meta/apidoc',
  outputDir: 'src/.cqrs',
  schemas: 'bundled',

  // Command-surface envelopes wrap data in a $ref. Extract the data schema $id.
  extractCommand(schema: JSONSchema7): string | undefined {
    const props = schema.properties
    if (typeof props !== 'object' || props === null) return undefined
    const dataRef = props['data']
    if (typeof dataRef === 'object' && dataRef !== null && '$ref' in dataRef) {
      return (dataRef as { $ref: string }).$ref
    }
    return undefined
  },

  commands: [
    'urn:command:nb.CreateTodo:1.0.0',
    'urn:command:nb.UpdateTodoContent:1.0.0',
    'urn:command:nb.ChangeTodoStatus:1.0.0',
    'urn:command:nb.DeleteTodo:1.0.0',
    'urn:command:nb.CreateNote:1.0.0',
    'urn:command:nb.UpdateNoteTitle:1.0.0',
    'urn:command:nb.UpdateNoteBody:1.0.0',
    'urn:command:nb.DeleteNote:1.0.0',
    'urn:command:nb.CreateNotebook:1.0.0',
    'urn:command:nb.UpdateNotebookName:1.0.0',
    'urn:command:nb.DeleteNotebook:1.0.0',
  ],

  representations: [
    'urn:representation:nb.Todo:1.0.0',
    'urn:representation:nb.Note:1.0.0',
    'urn:representation:nb.Notebook:1.0.0',
  ],
})
