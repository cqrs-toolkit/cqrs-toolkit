/**
 * Fastify plugin that loads and serves Hydra API documentation, OpenAPI docs, and JSON schemas.
 * Configured from the same HydraConfig used by the CLI.
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import assert from 'node:assert'
import { loadMetaBundle } from '../builder/resolve.js'
import { normalizePathSegment } from '../builder/utils.js'
import type { HydraConfig } from '../cli/config-types.js'

export interface MetaPluginOptions {
  /** The server portion of the toolkit config */
  config: HydraConfig
  /** Environment name to resolve URLs (default: 'dev') */
  env?: string
}

export function createMetaPlugin(opts: MetaPluginOptions): FastifyPluginAsync {
  const { config } = opts
  const envName = opts.env ?? 'dev'

  const envConfig = config.environments?.[envName]
  assert(
    envConfig,
    `Environment '${envName}' not found in config.environments. ` +
      `Available: ${Object.keys(config.environments ?? {}).join(', ') || '(none)'}`,
  )

  const sourceDir = config.docs.outputDir
  const docsEntrypoint = envConfig.documentEntrypoint
  const apiEntrypoint = envConfig.apiEntrypoint

  const bundle = loadMetaBundle({
    sourceDir,
    docsEntrypoint,
    apiEntrypoint,
    schemaUrnResolver: config.schema,
  })

  const apidoc = bundle.apidoc
  if (!apidoc) {
    throw new Error(`apidoc.jsonld not found in ${sourceDir} — run documentation generation first`)
  }

  // Derive route prefix from the documentEntrypoint URL path
  const docsPath = new URL(docsEntrypoint).pathname

  // Derive schemas path segment
  const schemasSegment = config.schema ? normalizePathSegment(config.schema.pathSegment) : 'schemas'

  return async function metaPlugin(app: FastifyInstance): Promise<void> {
    app.get(`${docsPath}/apidoc`, async (request, reply) => {
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

    if (bundle.openapi) {
      const openapi = bundle.openapi
      app.get(`${docsPath}/openapi`, async (request, reply) => {
        reply.header('Content-Type', 'application/json')
        reply.header('ETag', openapi.etag)
        reply.header('Cache-Control', 'public, max-age=0, must-revalidate')
        if (request.headers['if-none-match'] === openapi.etag) {
          return reply.status(304).send()
        }
        return reply.send(openapi.content)
      })
    }

    app.get(`${docsPath}/${schemasSegment}/*`, async (request, reply) => {
      const wildcard = (request.params as Record<string, string>)['*']
      const content = bundle.schemas.get(`${schemasSegment}/${wildcard}`)
      if (!content) {
        return reply.status(404).send()
      }
      reply.header('Content-Type', 'application/schema+json')
      reply.header('Cache-Control', 'public, max-age=31536000, immutable')
      return reply.send(content)
    })
  }
}
