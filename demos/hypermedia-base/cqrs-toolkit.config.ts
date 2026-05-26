import { defineConfig } from '@cqrs-toolkit/hypermedia-cli/config'
import type { JSONSchema7 } from 'json-schema'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  client: {
    server: 'http://localhost:3002',
    apidocPath: '/api/meta/apidoc',
    outputDir: path.resolve(__dirname, 'src/cqrs'),
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
      {
        urn: 'urn:command:nb.CreateNote:1.0.0',
        idReferences: [
          { kind: 'id', path: '$.notebookId', aggregateUrn: 'urn:aggregate:nb.Notebook' },
        ],
      },
      'urn:command:nb.UpdateNoteTitle:1.0.0',
      'urn:command:nb.UpdateNoteBody:1.0.0',
      'urn:command:nb.DeleteNote:1.0.0',
      'urn:command:nb.CreateNotebook:1.0.0',
      'urn:command:nb.UpdateNotebookName:1.0.0',
      'urn:command:nb.DeleteNotebook:1.0.0',
      'urn:command:nb.AddNotebookTag:1.0.0',
      'urn:command:nb.RemoveNotebookTag:1.0.0',
      {
        urn: 'urn:command:storage.CreateFileObject:1.0.0',
        idReferences: [{ kind: 'id', path: '$.noteId', aggregateUrn: 'urn:aggregate:nb.Note' }],
      },
      'urn:command:storage.DeleteFileObject:1.0.0',
    ],

    // Per-rep idReferences. Mirrors the runtime collection configs:
    // self-id (`$.id`) entries with no aggregateUrn are typing-only;
    // foreign-id entries (with aggregateUrn) also propagate to the
    // manifest's `generatedIdReferences` for `getGeneratedIdReferences`.
    representations: [
      {
        urn: 'urn:representation:nb.Todo:1.0.0',
        idReferences: [{ kind: 'id', path: '$.id' }],
      },
      {
        urn: 'urn:representation:nb.Note:1.0.0',
        idReferences: [
          { kind: 'id', path: '$.id' },
          { kind: 'id', path: '$.notebookId', aggregateUrn: 'urn:aggregate:nb.Notebook' },
        ],
      },
      {
        urn: 'urn:representation:nb.Notebook:1.0.0',
        idReferences: [{ kind: 'id', path: '$.id' }],
      },
      {
        urn: 'urn:representation:storage.FileObject:1.0.0',
        idReferences: [
          { kind: 'id', path: '$.id' },
          { kind: 'id', path: '$.noteId', aggregateUrn: 'urn:aggregate:nb.Note' },
          { kind: 'id', path: '$.notebookId', aggregateUrn: 'urn:aggregate:nb.Notebook' },
        ],
      },
    ],
  },
})
