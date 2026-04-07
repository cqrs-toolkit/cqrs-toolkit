/**
 * Apidoc and schema serving routes.
 *
 * Loads committed static/meta/ files via loadMetaBundle at registration time,
 * resolving URNs to dereferenceable URLs for the current server port.
 */

import { loadMetaBundle } from '@cqrs-toolkit/hypermedia/builder'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const sourceDir = resolve(__dirname, '../../static/meta')

export function metaRoutes(port: string | number): FastifyPluginAsync {
  return async function routes(app: FastifyInstance): Promise<void> {
    // TODO: config should be loaded from cqrs-toolkit.config.ts or a shared source file somehow
    const bundle = loadMetaBundle({
      sourceDir,
      docsEntrypoint: `http://localhost:${port}/api/meta`,
      apiEntrypoint: `http://localhost:${port}/api`,
      schemaUrnResolver: {
        pathSegment: 'schemas',
        isUrn: (v: string) => v.startsWith('urn:'),
        mapUrnToUrl: (urn: string): string => {
          return `${urn.replaceAll(':', '/')}.json`
        },
      },
    })

    if (bundle.apidoc) {
      const apidoc = bundle.apidoc
      app.get('/api/meta/apidoc', async (request, reply) => {
        reply.header(
          'Content-Type',
          'application/ld+json; profile="http://www.w3.org/ns/hydra/core#apiDocumentation"',
        )
        reply.header('ETag', apidoc.etag)
        reply.header('Cache-Control', 'public, max-age=0, must-revalidate')
        if (request.headers['if-none-match'] === apidoc.etag) {
          return reply.status(304).send()
        }
        return reply.send(apidoc.content)
      })
    }

    if (bundle.openapi) {
      const openapi = bundle.openapi
      app.get('/api/meta/openapi', async (request, reply) => {
        reply.header('Content-Type', 'application/json')
        reply.header('ETag', openapi.etag)
        reply.header('Cache-Control', 'public, max-age=0, must-revalidate')
        if (request.headers['if-none-match'] === openapi.etag) {
          return reply.status(304).send()
        }
        return reply.send(openapi.content)
      })
    }

    app.get('/api/meta/schemas/*', async (request, reply) => {
      const wildcard = (request.params as Record<string, string>)['*']
      const content = bundle.schemas.get(`schemas/${wildcard}`)
      if (!content) {
        return reply.status(404).send()
      }
      reply.header('Content-Type', 'application/schema+json')
      reply.header('Cache-Control', 'public, max-age=31536000, immutable')
      return reply.send(content)
    })
  }
}
