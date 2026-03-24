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
    'urn:command:demo.CreateTodo:1.0.0',
    'urn:command:demo.UpdateTodoContent:1.0.0',
    'urn:command:demo.ChangeTodoStatus:1.0.0',
    'urn:command:demo.DeleteTodo:1.0.0',
    'urn:command:demo.CreateNote:1.0.0',
    'urn:command:demo.UpdateNoteTitle:1.0.0',
    'urn:command:demo.UpdateNoteBody:1.0.0',
    'urn:command:demo.DeleteNote:1.0.0',
    'urn:command:demo.CreateNotebook:1.0.0',
    'urn:command:demo.UpdateNotebookName:1.0.0',
    'urn:command:demo.DeleteNotebook:1.0.0',
  ],

  representations: ['#demo-todo-v1_0_0', '#demo-note-v1_0_0', '#demo-notebook-v1_0_0'],
})
