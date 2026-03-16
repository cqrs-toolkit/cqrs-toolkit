import { FastifyReply } from 'fastify'
import assert from 'node:assert'
import { deriveRequestedProfilesRaw, semverDesc, type ReqLike } from '../utils.js'

export interface ProfileSpec {
  readonly version: string
  readonly urn: string
}

export interface RepliedValue {
  kind: 'replied'
}

export type NegotiateResult<S extends ProfileSpec> =
  | RepliedValue
  | { kind: 'matched'; spec: S }
  | { kind: 'none' }

/**
 * Result-based profile negotiator.
 *
 * Parses Content-Profile / Accept-Profile headers (via `deriveRequestedProfilesRaw`),
 * matches against registered specs, and sends 406 when no spec matches.
 *
 * `varyTokens` controls which Vary tokens are emitted — the read side uses
 * `Accept, Accept-Profile` while the write side uses `Content-Type, Content-Profile`.
 */
export class ProfileNegotiator<S extends ProfileSpec> {
  readonly supported: string[]
  readonly latest: S

  private readonly _urnMap: Map<string, S>
  private readonly _varyTokens: string[]

  constructor(specs: S[], opts: { varyTokens: string[] }) {
    assert(specs.length > 0, 'ProfileNegotiator: at least one spec is required')

    this._varyTokens = opts.varyTokens

    const sorted = [...specs].sort((a, b) => semverDesc(a.version, b.version))
    this.latest = sorted[0]!
    this.supported = sorted.map((s) => s.urn)

    this._urnMap = new Map()
    for (const s of sorted) {
      assert(!this._urnMap.has(s.urn), `ProfileNegotiator: duplicate URN: ${s.urn}`)
      this._urnMap.set(s.urn, s)
    }
  }

  static appendVary(reply: FastifyReply, ...tokens: string[]) {
    const cur = String(reply.getHeader('Vary') || '')
    const have = new Set(
      cur
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    for (const t of tokens) have.add(t)
    const next = [...have].join(', ')
    if (next) reply.header('Vary', next)
  }

  /**
   * Match request headers against registered specs.
   * Sends 406 reply directly when unsupported.
   *
   * Returns:
   *   { kind: 'replied' }        — 406 sent, caller should return early
   *   { kind: 'matched', spec }  — exact URN match
   *   { kind: 'none' }           — no preference expressed by client
   */
  negotiate(request: ReqLike, reply: FastifyReply): NegotiateResult<S> {
    const requested = deriveRequestedProfilesRaw(request)

    if (!requested || requested.length === 0) return { kind: 'none' }

    for (const urn of requested) {
      const spec = this._urnMap.get(urn)
      if (spec) return { kind: 'matched', spec }
    }

    ProfileNegotiator.appendVary(reply, ...this._varyTokens)
    reply.code(406).type('application/json').send({
      error: 'Not Acceptable',
      reason: 'Unsupported profile for this endpoint',
      requested,
      supported: this.supported,
    })
    return { kind: 'replied' }
  }

  /** Look up a spec by URN. */
  get(urn: string): S | undefined {
    return this._urnMap.get(urn)
  }

  /** Set Content-Profile, Link, and Vary headers using the constructor-provided tokens. */
  applyHeaders(reply: FastifyReply, urn: string): void {
    ProfileNegotiator.appendVary(reply, ...this._varyTokens)
    reply.header('Link', `<${urn}>; rel="profile"`).header('Content-Profile', urn)
  }
}
