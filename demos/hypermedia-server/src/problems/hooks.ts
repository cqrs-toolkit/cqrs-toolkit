/**
 * Fastify integration for problem+json.
 *
 * Two concerns:
 * 1. `setupCorrelationIdHook` — adopt or generate `x-correlation-id` per request and
 *    expose it as `request.correlationId` so problems can echo it.
 * 2. `setupErrorHandler` — route uncaught errors through `handleErrorReply` so every
 *    error response carries the single problem+json envelope.
 *
 * Register the correlation hook before the error handler so the id is populated
 * by the time an error fires.
 */

import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { handleErrorReply } from './types.js'

export type CorrelationIdGenerator = () => string

export interface SetupCorrelationIdOptions {
  /** Override the default `crypto.randomUUID()` generator (useful for tests). */
  idGenerator?: CorrelationIdGenerator
}

/**
 * Adopt or generate a correlation ID for every request and echo it on the response.
 *
 * Read order: incoming `x-correlation-id` header → generated via `idGenerator`.
 * Writes the resolved value to `request.correlationId`, the request header (so any
 * downstream reader sees the same value), and the `x-correlation-id` response header.
 */
export function setupCorrelationIdHook(
  app: FastifyInstance,
  options: SetupCorrelationIdOptions = {},
): void {
  const idGenerator = options.idGenerator ?? randomUUID
  app.addHook('onRequest', async (request, reply) => {
    const incoming = request.headers['x-correlation-id']
    const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : idGenerator()
    request.correlationId = id
    request.headers['x-correlation-id'] = id
    reply.header('x-correlation-id', id)
  })
}

/**
 * Route every uncaught error through `handleErrorReply` so all error responses share the
 * problem+json envelope, status code, and `x-correlation-id` header.
 *
 * Register after `setupCorrelationIdHook` so `request.correlationId` is populated by the
 * time an error fires.
 */
export function setupErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, request, reply) => {
    if (err instanceof Error && err.name === 'FastifyError') {
      // Fastify's own validation/parse errors carry a statusCode; pass through with
      // the same envelope.
      request.log.debug({ err }, 'Fastify error converted to problem')
    } else {
      request.log.error({ err }, 'Unhandled error')
    }
    handleErrorReply(request, reply, err)
  })
}
