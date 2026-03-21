import { SchemaException, validatorProvider } from '@cqrs-toolkit/schema'
import { Err, Ok, Result } from '@meticoeus/ddd-es'
import { FastifyReply } from 'fastify'
import { JSONSchema7 } from 'json-schema'
import assert from 'node:assert'
import { HydraDoc } from '../HydraDoc.js'
import { semverDesc, type ReqLike } from '../utils.js'
import { ProfileNegotiator, ProfileSpec, RepliedValue } from './ProfileNegotiator.js'

// ---------- Public types ----------

export interface CommandDispatchExtractor {
  /**
   * Extract the validation schema from the capability.
   * Determines what subset of the capability's full body schema should be validated
   * against the data passed to validate().
   */
  getValidationSchema(cap: HydraDoc.CommandCapability<string>): JSONSchema7
}

// ---------- Internal types ----------

interface VersionedCapability extends ProfileSpec {
  readonly cap: HydraDoc.CommandCapability<string>
}

interface OldVersionCap extends ProfileSpec {
  readonly cap: HydraDoc.CommandCapability<string> & {
    readonly adapt: HydraDoc.Adapter
  }
}

interface LatestVersionCap extends ProfileSpec {
  readonly cap: HydraDoc.CommandCapability<string> & {
    readonly schema: JSONSchema7
  }
}

interface VersionChain {
  readonly old: OldVersionCap[]
  readonly latest: LatestVersionCap
}

// ---------- Public result types ----------

export type ValidateValue<T> = RepliedValue | { kind: 'validated'; value: T; urn: string }

/**
 * CommandPlanner: boundary validation + version negotiation + hydration for commands.
 *
 * Composes a ProfileNegotiator for Content-Profile header negotiation,
 * cascades adapters for old-version data, validates against the latest
 * version's JSON Schema, and optionally hydrates domain types.
 *
 * Construction-time validations (all assert):
 * - Every capability must have `stableId`
 * - No duplicate URNs
 * - Capabilities sharing a `stableId` must have distinct versions
 * - Per stableId group (sorted by semver ascending): all except last must have `adapt`,
 *   last must have `schema`
 */
export class CommandPlanner {
  private readonly _negotiator: ProfileNegotiator<OldVersionCap | LatestVersionCap>
  private readonly _chainByStableId: Map<string, VersionChain>

  constructor(
    protected readonly commandsDef: HydraDoc.CommandsDef<string>,
    protected readonly extractor: CommandDispatchExtractor,
  ) {
    // Sort each group ascending by version and validate adapter/schema rules
    this._chainByStableId = new Map()

    const allCaps = commandsDef.commands
    const allSpecs: VersionedCapability[] = []

    // Group by stableId
    const groupOld = new Map<string, OldVersionCap[]>()
    const groupLatest: LatestVersionCap[] = []
    for (const cap of allCaps) {
      assert(cap.stableId, `CommandPlanner: capability ${cap.id} is missing stableId`)
      const version = cap.version
      const vc: VersionedCapability = { cap, version, urn: cap.id }
      allSpecs.push(vc)

      if (cap.isLatest) {
        assert(
          cap.schema,
          `CommandPlanner: latest capability ${cap.id} (stableId=${cap.stableId}) must have a schema`,
        )
        groupLatest.push(vc as LatestVersionCap)
      } else {
        assert(
          vc.cap.adapt,
          `CommandPlanner: capability ${cap.id} (stableId=${cap.stableId}) is not the latest version and must have an adapt function`,
        )
        let group = groupOld.get(cap.stableId)
        if (!group) {
          groupOld.set(cap.stableId, [vc as OldVersionCap])
        } else {
          group.push(vc as OldVersionCap)
        }
      }
    }

    for (const latest of groupLatest) {
      const stableId = latest.cap.stableId
      const old = groupOld.get(stableId) ?? []
      // Sort ascending (negate semverDesc)
      old.sort((a, b) => semverDesc(b.version, a.version))

      // Validate distinct versions
      const versions = new Set<string>([latest.version])
      for (const vc of old) {
        assert(
          !versions.has(vc.version),
          `CommandPlanner: duplicate version ${vc.version} for stableId ${stableId}`,
        )
        versions.add(vc.version)
      }

      this._chainByStableId.set(stableId, {
        old,
        latest,
      })
    }

    // this really shouldn't happen but we can check to avoid runtime errors
    for (const [stableId] of groupOld) {
      if (!this._chainByStableId.has(stableId)) {
        assert.fail(`CommandPlanner: stableId ${stableId} not found in chainByStableId`)
      }
    }

    // cast confirmed above
    this._negotiator = new ProfileNegotiator(allSpecs as (OldVersionCap | LatestVersionCap)[], {
      varyTokens: ['Content-Type', 'Content-Profile'],
    })
  }

  /**
   * Negotiate version + validate + hydrate.
   *
   * `stableId` identifies the logical command for "no preference" resolution.
   * `T` is the latest domain params type (e.g., RenameRoomParams).
   *
   * Returns a discriminated union in the Ok channel:
   *   { kind: 'replied' }                    — 406 already sent (caller returns early)
   *   { kind: 'validated', value: T, urn }   — validation succeeded, typed data ready
   * Err channel:
   *   SchemaException                        — validation failed
   */
  parse<T>(
    request: ReqLike,
    reply: FastifyReply,
    data: unknown,
    stableId: string,
  ): Result<ValidateValue<T>, SchemaException> {
    const negotiation = this._negotiator.negotiate(request, reply)

    switch (negotiation.kind) {
      case 'replied':
        return Ok(negotiation)
      case 'none':
        const chain = this._chainByStableId.get(stableId)
        assert(chain, `CommandPlanner: unknown stableId: ${stableId}`)
        return this._parseLatest(data, chain)
    }

    const matched = negotiation.spec
    const matchedStableId = matched.cap.stableId
    const chain = this._chainByStableId.get(matchedStableId)
    assert(chain, `CommandPlanner: unknown stableId: ${matchedStableId}`)

    // Adapt old-version data to latest shape, then validate
    const latestData =
      matched.urn === chain.latest.urn ? data : this._uplift(data, matched.urn, chain)

    return this._parseLatest(latestData, chain, matched.urn)
  }

  /** Set response headers after successful command processing. */
  applyHeaders(reply: FastifyReply, urn: string): void {
    this._negotiator.applyHeaders(reply, urn)
  }

  /**
   * Validate a command-dispatch request body.
   *
   * Looks up the stableId from the dispatch string, then delegates to validate()
   * for version negotiation + schema validation (using the extractor for schema selection).
   *
   * For command-envelope routes only (not create or custom surfaces).
   * Assumes the envelope is already validated by Fastify — only the domain data is validated here.
   */
  parseCommandDispatch<U extends { stableId: string; data: unknown }>(
    request: ReqLike,
    reply: FastifyReply,
    data: unknown,
    dispatch: string,
  ): Result<RepliedValue | ({ kind: 'validated' } & U), SchemaException> {
    // Manual lookup instead of getStableId() — unknown dispatch is a user error (bad request),
    // not a code bug, so return SchemaException instead of asserting
    const cap = this.commandsDef.commands.find((c) => c.commandType === dispatch && c.isLatest)
    if (!cap?.stableId) {
      return Err(
        new SchemaException([
          {
            path: 'command.type',
            code: 'enum',
            message: `unknown command type: ${dispatch}`,
            params: {},
          },
        ]),
      )
    }

    const stableId = cap.stableId
    const res = this.parse<unknown>(request, reply, data, stableId)
    if (!res.ok) return res
    if (res.value.kind === 'replied') return Ok(res.value)

    // Justified boundary cast — schema validation guarantees data matches U's data type
    // for the given stableId, and stableId comes from the CommandsDef mapping
    const output = {
      kind: 'validated',
      urn: cap.id,
      stableId,
      data: res.value.value as U,
    } as unknown as { kind: 'validated' } & U
    return Ok(output)
  }

  private _parseLatest<T>(
    data: unknown,
    chain: VersionChain,
    urn?: string,
  ): Result<ValidateValue<T>, SchemaException> {
    const schema = this.extractor.getValidationSchema(chain.latest.cap)
    const parseRes = validatorProvider.parse<T>(schema, data, chain.latest.cap.hydrate)
    if (!parseRes.ok) return parseRes

    return Ok({ kind: 'validated', value: parseRes.value, urn: urn ?? chain.latest.urn })
  }

  /** Cascade adapters from the matched old version through to latest version. */
  private _uplift(data: unknown, matchedUrn: string, chain: VersionChain): unknown {
    const idx = chain.old.findIndex((c) => c.urn === matchedUrn)
    assert(idx >= 0, `CommandPlanner: matched URN ${matchedUrn} not found in chain`)

    let current = data
    for (const vc of chain.old.slice(idx)) {
      current = vc.cap.adapt(current)
    }
    return current
  }
}
