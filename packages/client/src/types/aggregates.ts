import { Link, ServiceLink } from '@meticoeus/ddd-es'
import { EntityId } from './entities.js'
import { JSONPathExpression } from './json-path.js'

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
