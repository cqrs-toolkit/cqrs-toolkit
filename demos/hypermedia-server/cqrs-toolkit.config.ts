import { defineConfig } from '@cqrs-toolkit/hypermedia-cli/config'
import { builtinPropertyDictionary } from '@cqrs-toolkit/hypermedia/builder'
import { HydraDemoClasses } from './src/doc.js'

export default defineConfig({
  server: {
    classes: HydraDemoClasses,
    prefixes: ['nb', 'storage', 'svc'],
    environments: {
      dev: {
        apiEntrypoint: 'http://localhost:3002/api',
        documentEntrypoint: 'http://localhost:3002/api/meta',
      },
    },
    docs: {
      outputDir: 'static/meta',
    },
    build: {
      outputDir: 'dist/static/meta',
    },
    openapi: {
      info: { title: 'Hypermedia Demo API', version: '1.0.0' },
      hydraPropertyDictionary: {
        ...builtinPropertyDictionary,
        'nb:todoId': { schema: { type: 'string' }, description: 'Todo identifier' },
        'nb:noteId': { schema: { type: 'string' }, description: 'Note identifier' },
        'nb:notebookId': { schema: { type: 'string' }, description: 'Notebook identifier' },
        'storage:fileObjectId': {
          schema: { type: 'string' },
          description: 'File object identifier',
        },
      },
    },
    schema: {
      pathSegment: 'schemas',
      isUrn: (v: string) => v.startsWith('urn:'),
      mapUrnToUrl: (urn: string): string => {
        return `${urn.replaceAll(':', '/')}.json`
      },
    },
  },
})
