/**
 * Reusable fetch helpers for hypermedia-formatted event endpoints.
 *
 * Handles Accept header, response parsing, and event hydration.
 * Used internally by createCollection and exported for consumers who want full control.
 */

import {
  hydrateSerializedEvent,
  type FetchContext,
  type IPersistedEvent,
  type ISerializedEvent,
  type SeedEventPage,
} from '@cqrs-toolkit/client'

/**
 * Fetch a page of events from a hypermedia-formatted aggregate events endpoint.
 *
 * @param ctx - Fetch context with baseUrl, headers, and signal
 * @param endpoint - Relative endpoint path (e.g. '/api/events/todos')
 * @param cursor - Pagination cursor (null for first page)
 * @param limit - Page size
 */
export async function fetchEventPage(
  ctx: FetchContext,
  endpoint: string,
  cursor: string | null,
  limit: number,
): Promise<SeedEventPage> {
  const url = new URL(endpoint, ctx.baseUrl)
  if (cursor) url.searchParams.set('cursor', cursor)
  url.searchParams.set('limit', String(limit))

  const res = await fetch(url.toString(), {
    headers: { ...ctx.headers, Accept: 'application/json' },
    signal: ctx.signal,
  })
  if (!res.ok) throw new Error(`Seed fetch failed: ${res.status}`)

  const data: unknown = await res.json()
  const parsed = parseEventResponse(data)
  return {
    events: parsed.entities.map(hydrateSerializedEvent),
    nextCursor: parsed.nextCursor ?? null,
  }
}

/**
 * Fetch per-stream events for gap recovery from a hypermedia-formatted item events endpoint.
 *
 * @param ctx - Fetch context with baseUrl, headers, and signal
 * @param endpoint - Relative endpoint path with {id} already expanded (e.g. '/api/todos/abc/events')
 * @param afterRevision - Fetch events after this revision
 */
export async function fetchStreamEvents(
  ctx: FetchContext,
  endpoint: string,
  afterRevision: bigint,
): Promise<IPersistedEvent[]> {
  const url = new URL(endpoint, ctx.baseUrl)
  url.searchParams.set('afterRevision', String(afterRevision))

  const res = await fetch(url.toString(), {
    headers: { ...ctx.headers, Accept: 'application/json' },
    signal: ctx.signal,
  })
  if (!res.ok) throw new Error(`Stream fetch failed: ${res.status}`)

  const data: unknown = await res.json()
  const parsed = parseEventResponse(data)
  return parsed.entities.map(hydrateSerializedEvent)
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

interface EventResponse {
  entities: ISerializedEvent[]
  nextCursor?: string
}

function parseEventResponse(data: unknown): EventResponse {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Expected object response from event endpoint')
  }
  const obj = data as Record<string, unknown>
  if (!Array.isArray(obj['entities'])) {
    throw new Error('Expected { entities: [...] } response from event endpoint')
  }
  return {
    entities: obj['entities'] as ISerializedEvent[],
    nextCursor: typeof obj['nextCursor'] === 'string' ? obj['nextCursor'] : undefined,
  }
}
