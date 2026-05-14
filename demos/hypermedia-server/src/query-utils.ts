/**
 * Shared query utilities and types for the hypermedia demo server.
 *
 * Matches the production common-infrastructure read-server-utils pattern.
 */

import type { Querystring } from '@cqrs-toolkit/hypermedia'
import type { RepliedValue } from '@cqrs-toolkit/hypermedia/server'
import type { IException, Result } from '@meticoeus/ddd-es'
import type { FastifyReply } from 'fastify'
import { handleErrorReply, type ProblemRequest } from './problems/index.js'

// ---------------------------------------------------------------------------
// Fastify route generic types
// ---------------------------------------------------------------------------

export interface GetListRequest {
  Querystring: Querystring
}

export interface GetByIdRequest {
  Params: { id: string }
  Querystring: Querystring
}

export interface GetItemEventsRequest {
  Params: { id: string }
  Querystring: { afterRevision?: string }
}

export interface GetAggregateEventsRequest {
  Querystring: { cursor?: string; limit?: string }
}

/**
 * Typed params for versioned resolvers (lowercase — Fastify request shape, not route generic).
 */
export interface GetByIdRequestParams {
  params: { id: string }
}

// ---------------------------------------------------------------------------
// ProfileHandler error handling
// ---------------------------------------------------------------------------

/**
 * Unwrap a ProfileHandler.resolve() result.
 * On success the response is already sent (kind: 'replied').
 * On error, emit a problem+json response.
 */
export async function handleProfileHandler(
  request: ProblemRequest,
  reply: FastifyReply,
  promise: Promise<Result<RepliedValue, IException>>,
): Promise<void> {
  const res = await promise
  if (!res.ok) {
    handleErrorReply(request, reply, res.error)
  }
}
