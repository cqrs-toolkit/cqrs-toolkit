import { IException, Ok, Result } from '@meticoeus/ddd-es'
import { FastifyReply } from 'fastify'
import assert from 'node:assert'
import type { ReqLike } from '../utils.js'
import { Hypermedia } from './format.js'
import { ProfileNegotiator, type RepliedValue } from './ProfileNegotiator.js'

// ---------- Public types ----------

export interface ResolvedValue {
  kind: 'resolved'
  contentType: string
  body: unknown
}

export interface NegotiatedProfile<
  Locals,
  Context,
  Request extends Hypermedia.Request = Hypermedia.Request,
  UseResolve extends boolean = boolean,
> {
  kind: 'negotiated'
  urn: string
  rep: RepresentationProfile<Locals, Context, Request, UseResolve>
}

export type VersionResolver<
  Locals,
  Context,
  Request extends Hypermedia.Request = Hypermedia.Request,
> = (
  request: Request,
  reply: FastifyReply,
  locals: Locals,
  context: Context,
) => Promise<Result<ResolvedValue | RepliedValue, IException>>

/**
 * RepresentationProfile:
 * - If UseResolve = true  → `resolve` is REQUIRED. Handle normal resource cases.
 * - If UseResolve = false → `resolve` is OPTIONAL. Handle route resolution manually.
 */
export type RepresentationProfile<
  Locals,
  Context,
  Request extends Hypermedia.Request = Hypermedia.Request,
  UseResolve extends boolean = boolean,
> = UseResolve extends true
  ? {
      version: string
      urn: string
      resolve: VersionResolver<Locals, Context, Request>
    }
  : {
      version: string
      urn: string
      resolve?: VersionResolver<Locals, Context, Request>
    }

/**
 * Result-based profile handler for query endpoints.
 *
 * Composes a ProfileNegotiator for Accept-Profile header negotiation.
 * On success, sends the response with proper Content-Profile/Vary headers.
 * On negotiation failure (406), sends the error response directly.
 * Resolver errors are propagated to the caller via the Result Err channel
 * for centralized upstream handling.
 */
export class ProfileHandler<
  UseResolve extends boolean,
  Locals,
  Context,
  Request extends Hypermedia.Request = Hypermedia.Request,
> {
  private readonly _negotiator: ProfileNegotiator<
    RepresentationProfile<Locals, Context, Request, UseResolve>
  >

  constructor(opts: {
    representations: RepresentationProfile<Locals, Context, Request, UseResolve>[]
  }) {
    this._negotiator = new ProfileNegotiator(opts.representations, {
      varyTokens: ['Accept', 'Accept-Profile'],
    })
  }

  /**
   * Negotiate the profile.
   *
   * Returns:
   *   `{ kind: 'replied' }`     — 406 sent, caller should return early
   *   `{ kind: 'negotiated' }`  — profile matched (or default), ready to resolve
   */
  getRequestedProfile(
    request: ReqLike,
    reply: FastifyReply,
  ): RepliedValue | NegotiatedProfile<Locals, Context, Request, UseResolve> {
    const negotiation = this._negotiator.negotiate(request, reply)

    switch (negotiation.kind) {
      case 'replied':
        return negotiation
      case 'matched':
        return { kind: 'negotiated', urn: negotiation.spec.urn, rep: negotiation.spec }
      case 'none':
        return {
          kind: 'negotiated',
          urn: this._negotiator.latest.urn,
          rep: this._negotiator.latest,
        }
    }
  }

  /**
   * Negotiate profile, resolve, send response.
   *
   * On success or 406, sends the reply and returns `Ok({ kind: 'replied' })`.
   * On resolver error, propagates via `Err` for centralized upstream handling.
   */
  async resolve(
    request: Request,
    reply: FastifyReply,
    locals: Locals,
    context: Context,
  ): Promise<Result<RepliedValue, IException>> {
    const profile = this.getRequestedProfile(request, reply)
    if (profile.kind === 'replied') return Ok(profile)

    assert(profile.rep.resolve, `resolve() not implemented for profile ${profile.urn}`)

    const result = await profile.rep.resolve(request, reply, locals, context)
    if (!result.ok) return result

    if (result.value.kind === 'replied') return Ok(result.value)

    this.applyHeaders(reply, profile.urn)
    reply.type(result.value.contentType).send(result.value.body)
    return Ok({ kind: 'replied' })
  }

  /** Apply success headers ONLY after you have the response ready. */
  applyHeaders(reply: FastifyReply, urn: string): void {
    this._negotiator.applyHeaders(reply, urn)
  }
}
