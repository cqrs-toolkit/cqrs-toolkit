import {
  FetchContext,
  hydrateSerializedEvent,
  IPersistedEvent,
  ISerializedEvent,
  SeedRecordPage,
} from '@cqrs-toolkit/client'

export async function fetchSeedRecordPage(
  ctx: FetchContext,
  endpoint: string,
  cursor: string | null,
  limit: number,
): Promise<SeedRecordPage> {
  const url = new URL(`${ctx.baseUrl}${endpoint}`)
  if (cursor) url.searchParams.set('cursor', cursor)
  url.searchParams.set('limit', String(limit))
  const res = await fetch(url.toString(), { headers: ctx.headers })
  if (!res.ok) throw new Error(`Seed record fetch failed: ${res.status}`)
  const data = (await res.json()) as {
    items: Array<Record<string, unknown>>
    nextCursor: string | null
  }
  return {
    records: data.items.map((item) => ({
      id: item['id'] as string,
      data: item,
      revision: item['latestRevision'] as string | undefined,
    })),
    nextCursor: data.nextCursor,
  }
}

/** Type guard for the `{ events: [...], nextCursor?: string }` envelope the demo server returns. */
export function isDemoEventResponse(
  data: unknown,
): data is { events: ISerializedEvent[]; nextCursor?: string } {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return Array.isArray(obj['events'])
}

export async function fetchStreamEventsAfter(
  ctx: FetchContext,
  endpoint: string,
  afterRevision: bigint,
): Promise<IPersistedEvent[]> {
  const url = new URL(`${ctx.baseUrl}${endpoint}`)
  url.searchParams.set('afterRevision', String(afterRevision))
  const res = await fetch(url.toString(), { headers: ctx.headers })
  if (!res.ok) throw new Error(`Stream fetch failed: ${res.status}`)
  const data: unknown = await res.json()
  if (!isDemoEventResponse(data)) throw new Error('Expected { events: [...] } response')
  return data.events.map(hydrateSerializedEvent)
}

/** Extract aggregate ID from "Type-uuid" stream format used by the demo. */
export function aggregateId(streamId: string): string {
  return streamId.slice(streamId.indexOf('-') + 1)
}
