import { StreamIdParseException } from '@cqrs-toolkit/client'
import { Err, Ok, Result, ServiceLink } from '@meticoeus/ddd-es'

export function parseStreamId(streamId: string): Result<ServiceLink, StreamIdParseException> {
  const dotIndex = streamId.indexOf('.')
  if (dotIndex < 0) return Err(new StreamIdParseException(streamId))
  const service = streamId.slice(0, dotIndex)
  const rest = streamId.slice(dotIndex + 1)
  const dashIndex = rest.indexOf('-')
  if (dashIndex < 0) return Err(new StreamIdParseException(streamId))
  const type = rest.slice(0, dashIndex)
  const id = rest.slice(dashIndex + 1)
  if (service.length === 0 || type.length === 0 || id.length === 0) {
    return Err(new StreamIdParseException(streamId))
  }
  return Ok({ service, type, id } as ServiceLink)
}
