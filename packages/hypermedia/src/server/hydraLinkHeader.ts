/**
 * Fastify plugin that adds the standard Hydra Link header to all API responses,
 * informing clients where to find the API documentation.
 *
 * ```
 * Link: <https://api.example.com/api/meta/apidoc>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation"
 * ```
 *
 * @example
 * ```ts
 * import { hydraLinkHeader } from '@cqrs-toolkit/hypermedia/server'
 *
 * app.register(hydraLinkHeader, {
 *   apiDocUrl: 'https://api.example.com/api/meta/apidoc',
 * })
 * ```
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'

export interface HydraLinkHeaderOptions {
  /** Full URL to the served apidoc.jsonld */
  apiDocUrl: string
}

const HYDRA_REL = 'http://www.w3.org/ns/hydra/core#apiDocumentation'

export const hydraLinkHeader: FastifyPluginAsync<HydraLinkHeaderOptions> =
  async function hydraLinkHeader(
    app: FastifyInstance,
    opts: HydraLinkHeaderOptions,
  ): Promise<void> {
    const linkValue = `<${opts.apiDocUrl}>; rel="${HYDRA_REL}"`

    app.addHook('onSend', async (_request, reply) => {
      reply.header('Link', linkValue)
    })
  }
