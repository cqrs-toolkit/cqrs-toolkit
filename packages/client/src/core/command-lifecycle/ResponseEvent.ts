import { ISerializedEvent } from '@meticoeus/ddd-es'

/**
 * Shape of an individual event inside a command response.
 */
export type ResponseEvent = ISerializedEvent

/**
 * Type guard: does the response carry an `events` array with the fields we need?
 */
export function hasResponseEvents(response: unknown): response is { events: ResponseEvent[] } {
  if (typeof response !== 'object' || response === null) return false
  if (!('events' in response)) return false
  return Array.isArray(response.events)
}

/**
 * Type guard for an individual response event object.
 */
export function isResponseEvent(value: unknown): value is ResponseEvent {
  if (typeof value !== 'object' || value === null) return false
  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'type' in value &&
    typeof value.type === 'string' &&
    'streamId' in value &&
    typeof value.streamId === 'string' &&
    'data' in value &&
    'revision' in value &&
    typeof value.revision === 'string' &&
    'position' in value &&
    typeof value.position === 'string'
  )
}
