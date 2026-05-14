import { defineConfig } from '@cqrs-toolkit/hypermedia-cli/config'
import { builtinPropertyDictionary } from '@cqrs-toolkit/hypermedia/builder'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HydraDemoClasses } from './src/doc.js'
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from './src/problems/index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

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
      outputDir: path.resolve(__dirname, 'static/meta'),
    },
    build: {
      outputDir: path.resolve(__dirname, 'dist/static/meta'),
    },
    openapi: {
      info: { title: 'Hypermedia Demo API', version: '1.0.0' },
      globalResponses: [
        {
          code: 500,
          contentType: PROBLEM_CONTENT_TYPE,
          schema: ProblemSchema,
          description: 'Unexpected server error.',
        },
      ],
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
      requestHeaders: {
        'X-Request-Id': {
          schema: { type: 'string' },
          description:
            'Idempotency key for POST commands. The server caches the response for 5 minutes so retried requests with the same key return the cached result.',
        },
        'X-Correlation-Id': {
          schema: { type: 'string' },
          description:
            'Correlation identifier propagated through logs. Generated server-side if absent.',
        },
      },
      globalRequestHeaders: ['X-Correlation-Id', 'X-Request-Id'],
      responseHeaders: {
        'X-Correlation-Id': {
          schema: { type: 'string' },
          description:
            'Echoes the request correlation id, generating one if the request did not provide it.',
        },
        Location: {
          schema: { type: 'string', format: 'uri' },
          required: true,
          description: 'Redirect target URL.',
        },
      },
      globalResponseHeaders: ['X-Correlation-Id'],
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
