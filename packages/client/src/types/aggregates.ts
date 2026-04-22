import { Exception, Link, Result, ServiceLink } from '@meticoeus/ddd-es'
import { type EntityId, type EntityTLink, isEntityRef } from './entities.js'
import { JSONPathExpression } from './json-path.js'

/**
 * An aggregate affected by a command, carrying both the canonical streamId
 * (the chain/concurrency key, read directly from the anticipated event) and
 * the EntityId-aware TLink (for reconciliation across EntityRef lifecycles).
 */
export interface AffectedAggregate<TLink extends Link> {
  streamId: string
  link: EntityTLink<TLink>
}

export class StreamIdParseException extends Exception {
  constructor(public readonly streamId: string) {
    super('StreamIdParseException', `Failed to parse stream ID: ${streamId}`)
  }
}

export interface AggregateConfig<TLink extends Link> {
  service: TLink extends ServiceLink ? TLink['service'] : never
  type: TLink['type']
  /** Build a stream ID from an entity ID. Accepts EntityId — implementations must
   *  call entityIdToString() to extract the plain string. */
  getStreamId(entityId: EntityId): string
  getLinkMatcher(): Omit<TLink, 'id'>
}

export class ClientAggregate<TLink extends Link> implements AggregateConfig<TLink> {
  readonly service: TLink extends ServiceLink ? TLink['service'] : never
  readonly type: TLink['type']

  readonly getStreamId: (entityId: EntityId) => string

  constructor(config: Omit<AggregateConfig<TLink>, 'getLinkMatcher'>) {
    this.service = config.service
    this.type = config.type
    this.getStreamId = config.getStreamId
  }

  public getLinkMatcher(): Omit<TLink, 'id'> {
    // @ts-ignore - I don't know why tsc doesn't like this function...
    return this.service ? { service: this.service, type: this.type } : { type: this.type }
  }
}

// Plain ID field — path points to a string (the aggregate ID itself)
export interface DirectIdReference<TLink extends Link> {
  aggregate: AggregateConfig<TLink>
  path: JSONPathExpression
}

// Link field — path points to a Link object containing type+id
export interface LinkIdReference<TLink extends Link> {
  aggregates: AggregateConfig<TLink>[]
  path: JSONPathExpression
}

export type IdReference<TLink extends Link> = DirectIdReference<TLink> | LinkIdReference<TLink>

// Response variants: add a revision path so the reconcile step can update
// the aggregate chain's lastKnownRevision alongside the id mapping.
export interface ResponseDirectIdReference<TLink extends Link> extends DirectIdReference<TLink> {
  revisionPath?: JSONPathExpression
}

export interface ResponseLinkIdReference<TLink extends Link> extends LinkIdReference<TLink> {
  revisionPath?: JSONPathExpression
}

export type ResponseIdReference<TLink extends Link> =
  | ResponseDirectIdReference<TLink>
  | ResponseLinkIdReference<TLink>

/**
 * Internal aggregate registry interface. Provides the aggregate list and a
 * user-implemented stream parser that maps stream IDs to TLink values based
 * on the app's naming convention.
 */
export interface IClientAggregates<TLink extends Link> {
  aggregates: AggregateConfig<TLink>[]
  parseStreamId: (streamId: string) => Result<TLink, StreamIdParseException>
}

/**
 * Type guard for Link-shaped objects whose `id` may be an EntityId.
 *
 * Matches `{ type: string, id: EntityId }` with optional `service: string`.
 * Distinct from the server-side `Link` from `@meticoeus/ddd-es` — the `id`
 * field allows EntityRef values because anticipated events carry EntityRefs
 * before reconciliation.
 */
export function isEntityIdLink<TLink extends Link>(value: unknown): value is EntityTLink<TLink> {
  if (typeof value !== 'object' || value === null) return false
  if (typeof (value as { type?: unknown }).type !== 'string') return false
  const id = (value as { id?: unknown }).id
  if (typeof id !== 'string' && !isEntityRef(id)) return false
  const service = (value as { service?: unknown }).service
  if (service !== undefined && typeof service !== 'string') return false
  return true
}

export function matchesAggregate<TLink extends Link>(
  link: Omit<TLink, 'id'>,
  aggregate: AggregateConfig<TLink>,
): boolean {
  // Cast: TLink guarantees both sides have the same shape, but tsc cannot narrow
  // a generic's structural fields through an `in` check on one parameter.
  if ('service' in aggregate && (link as unknown as ServiceLink).service !== aggregate.service) {
    return false
  }

  return aggregate.type === link.type
}
