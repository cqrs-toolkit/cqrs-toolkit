/**
 * chrome.devtools.network HAR pipe for the network probe.
 *
 * Runs in the panel context (chrome.devtools.* APIs aren't available in the
 * background service worker). Subscribes to onRequestFinished, which delivers
 * one HAR entry per completed request the inspected tab's DevTools sees —
 * page main-thread fetches + dedicated worker fetches spawned by the page.
 * Does not include WebSocket frames, and does not include SharedWorker
 * traffic (that comes from the chrome.debugger pipe in the background SW).
 *
 * Doesn't conflict with the user's DevTools — this is the same data
 * DevTools' own Network panel renders, surfaced to extension panels.
 */

import type { HttpRow } from './stores/network.js'

export interface HarCaptureControl {
  start(origin: string): void
  stop(): void
}

/**
 * Bind the onRequestFinished listener once. The returned controller toggles
 * whether incoming HAR entries are projected and forwarded; the listener
 * stays attached for the panel's lifetime.
 */
export function createHarCapture(onRow: (row: HttpRow) => void): HarCaptureControl {
  let capturing = false
  let origin = ''
  let seq = 0

  const listener = (entry: unknown): void => {
    if (!capturing) return
    const row = projectHarEntry(entry, ++seq, origin)
    onRow(row)
  }

  chrome.devtools.network.onRequestFinished.addListener(listener)

  return {
    start(o: string) {
      origin = o
      capturing = true
    },
    stop() {
      capturing = false
    },
  }
}

function projectHarEntry(entry: unknown, seq: number, origin: string): HttpRow {
  const request = readObject(entry, 'request')
  const response = readObject(entry, 'response')
  const timings = readObject(entry, 'timings')
  const startedDateTime = readString(entry, 'startedDateTime')
  const totalTimeMs = readNumber(entry, 'time')
  const initiator = readObject(entry, '_initiator')
  const resourceType = readString(entry, '_resourceType')
  const serverIp = readString(entry, 'serverIPAddress')

  const postData = readObject(request, 'postData')
  const content = readObject(response, 'content')
  const startedAt = startedDateTime ? Date.parse(startedDateTime) : undefined
  const finishedAt =
    startedAt !== undefined && totalTimeMs !== undefined && !Number.isNaN(startedAt)
      ? startedAt + totalTimeMs
      : undefined

  return {
    id: `har:${seq}`,
    kind: 'http',
    timestamp: startedAt ?? Date.now(),
    source: 'page',
    session: {
      sessionId: 'har',
      targetType: inferTargetType(initiator, resourceType),
      targetUrl: readString(initiator, 'url') ?? origin,
    },
    url: readString(request, 'url') ?? '',
    method: readString(request, 'method') ?? 'GET',
    requestHeaders: readHarHeaders(request, 'headers'),
    requestBodyPreview: clipPreview(readString(postData, 'text')),
    status: readNumber(response, 'status'),
    statusText: readString(response, 'statusText'),
    responseHeaders: readHarHeaders(response, 'headers'),
    mimeType: readString(content, 'mimeType'),
    resourceType,
    initiatorType: readString(initiator, 'type'),
    initiatorUrl: readString(initiator, 'url'),
    remoteIpAddress: serverIp,
    encodedDataLength: readNumber(content, 'size') ?? readNumber(response, 'bodySize'),
    timing: timings ? filterNumbersOnly(timings) : undefined,
    startedAt,
    finishedAt,
    events: [],
  }
}

function inferTargetType(
  initiator: Record<string, unknown> | undefined,
  resourceType: string | undefined,
): string {
  if (resourceType === 'document') return 'page'
  const initiatorUrl = readString(initiator, 'url')
  if (initiatorUrl && /worker/i.test(initiatorUrl)) return 'worker'
  return 'page'
}

// ---------------------------------------------------------------------------
// Helpers — narrow unknown HAR-entry payloads without `as` / `any`
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  return value as Record<string, unknown>
}

function readString(obj: unknown, key: string): string | undefined {
  const rec = asRecord(obj)
  if (!rec) return undefined
  const v = rec[key]
  return typeof v === 'string' ? v : undefined
}

function readNumber(obj: unknown, key: string): number | undefined {
  const rec = asRecord(obj)
  if (!rec) return undefined
  const v = rec[key]
  return typeof v === 'number' ? v : undefined
}

function readObject(obj: unknown, key: string): Record<string, unknown> | undefined {
  const rec = asRecord(obj)
  if (!rec) return undefined
  return asRecord(rec[key])
}

/** HAR-format header arrays: [{ name, value }, ...] → record. */
function readHarHeaders(parent: unknown, key: string): Record<string, string> {
  const rec = asRecord(parent)
  if (!rec) return {}
  const headers = rec[key]
  if (!Array.isArray(headers)) return {}
  const out: Record<string, string> = {}
  for (const h of headers) {
    const hr = asRecord(h)
    if (!hr) continue
    const name = typeof hr['name'] === 'string' ? (hr['name'] as string) : undefined
    const value = typeof hr['value'] === 'string' ? (hr['value'] as string) : undefined
    if (name && value !== undefined) out[name] = value
  }
  return out
}

function filterNumbersOnly(obj: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (typeof v === 'number') out[k] = v
  }
  return out
}

function clipPreview(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const limit = 1024
  if (value.length <= limit) return value
  return value.slice(0, limit)
}
