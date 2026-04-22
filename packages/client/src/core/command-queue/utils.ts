import { Link, Ok, Result } from '@meticoeus/ddd-es'
import {
  AffectedAggregate,
  IClientAggregates,
  StreamIdParseException,
} from '../../types/aggregates.js'
import { EntityTLink } from '../../types/entities.js'
import { IAnticipatedEvent } from '../command-lifecycle/AnticipatedEventShape.js'

export function deriveAffectedAggregates<TLink extends Link>(
  aggregates: IClientAggregates<TLink>,
  events: IAnticipatedEvent[],
): Result<AffectedAggregate<TLink>[], StreamIdParseException> {
  const affected: AffectedAggregate<TLink>[] = []
  const streams = new Set<string>()

  for (const event of events) {
    if (streams.has(event.streamId)) continue

    const res = aggregates.parseStreamId(event.streamId)
    if (!res.ok) return res

    const link: EntityTLink<TLink> = {
      ...res.value,
      id: event.data.id,
    }
    affected.push({ streamId: event.streamId, link })
    streams.add(event.streamId)
  }

  return Ok(affected)
}
