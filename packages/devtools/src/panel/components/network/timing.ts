/**
 * Compute Chrome-style timing phase breakdown from a captured HttpRow.
 *
 * CDP `response.timing` fields are all in ms relative to `requestTime` (a
 * monotonic seconds value). We treat that as the t=0 reference and project
 * everything onto a 0→totalMs axis. The content-download tail is computed
 * from the wall-clock `finishedAt - startedAt` delta minus `receiveHeadersEnd`.
 */

import type { HttpRow } from '../../stores/network.js'

export interface TimingPhase {
  name: string
  startMs: number
  endMs: number
  color: string
}

export interface TimingBreakdown {
  connectionStart: TimingPhase[]
  requestResponse: TimingPhase[]
  /** Total time covered by the axis (max of all phase ends + wall delta). */
  totalMs: number
  /** Earliest phase start (usually 0; non-zero when only DNS/connect/etc. are populated). */
  axisStartMs: number
  /** True if no usable timing data was available. */
  empty: boolean
}

export function computeTimingBreakdown(row: HttpRow): TimingBreakdown {
  const t = row.timing ?? {}
  const get = (key: string): number | undefined => {
    const v = t[key]
    if (typeof v !== 'number') return undefined
    return v < 0 ? undefined : v
  }

  const connectionStart: TimingPhase[] = []
  const requestResponse: TimingPhase[] = []

  const dnsStart = get('dnsStart')
  const dnsEnd = get('dnsEnd')
  const connectStart = get('connectStart')
  const connectEnd = get('connectEnd')
  const sslStart = get('sslStart')
  const sslEnd = get('sslEnd')
  const proxyStart = get('proxyStart')
  const proxyEnd = get('proxyEnd')
  const sendStart = get('sendStart')
  const sendEnd = get('sendEnd')
  const receiveHeadersStart = get('receiveHeadersStart')
  const receiveHeadersEnd = get('receiveHeadersEnd')

  // Stalled: from 0 to the first network phase.
  const firstPhaseStart = minDefined([proxyStart, dnsStart, connectStart, sendStart])
  if (firstPhaseStart !== undefined && firstPhaseStart > 0) {
    connectionStart.push({
      name: 'Stalled',
      startMs: 0,
      endMs: firstPhaseStart,
      color: 'var(--text-muted)',
    })
  }

  if (proxyStart !== undefined && proxyEnd !== undefined && proxyEnd > proxyStart) {
    connectionStart.push({
      name: 'Proxy negotiation',
      startMs: proxyStart,
      endMs: proxyEnd,
      color: 'var(--text-muted)',
    })
  }

  if (dnsStart !== undefined && dnsEnd !== undefined && dnsEnd > dnsStart) {
    connectionStart.push({
      name: 'DNS lookup',
      startMs: dnsStart,
      endMs: dnsEnd,
      color: 'var(--bus-readmodel)',
    })
  }

  if (connectStart !== undefined && connectEnd !== undefined && connectEnd > connectStart) {
    connectionStart.push({
      name: 'Initial connection',
      startMs: connectStart,
      endMs: connectEnd,
      color: 'var(--status-pending)',
    })
  }

  if (sslStart !== undefined && sslEnd !== undefined && sslEnd > sslStart) {
    connectionStart.push({
      name: 'SSL',
      startMs: sslStart,
      endMs: sslEnd,
      color: 'var(--banner-warning-text)',
    })
  }

  if (sendStart !== undefined && sendEnd !== undefined && sendEnd > sendStart) {
    requestResponse.push({
      name: 'Request sent',
      startMs: sendStart,
      endMs: sendEnd,
      color: 'var(--status-sending)',
    })
  }

  // Waiting (TTFB): from sendEnd to receiveHeadersStart (or End if Start absent).
  const waitStart = sendEnd
  const waitEnd = receiveHeadersStart ?? receiveHeadersEnd
  if (waitStart !== undefined && waitEnd !== undefined && waitEnd > waitStart) {
    requestResponse.push({
      name: 'Waiting for server response',
      startMs: waitStart,
      endMs: waitEnd,
      color: 'var(--status-succeeded)',
    })
  }

  // Content download: from receiveHeadersEnd to wall-clock end.
  const wallTotalMs = computeWallTotalMs(row)
  if (
    receiveHeadersEnd !== undefined &&
    wallTotalMs !== undefined &&
    wallTotalMs > receiveHeadersEnd
  ) {
    requestResponse.push({
      name: 'Content download',
      startMs: receiveHeadersEnd,
      endMs: wallTotalMs,
      color: 'var(--status-sending)',
    })
  }

  const allPhases = [...connectionStart, ...requestResponse]
  const empty = allPhases.length === 0
  const totalMs = empty
    ? (wallTotalMs ?? 0)
    : Math.max(wallTotalMs ?? 0, ...allPhases.map((p) => p.endMs))
  const axisStartMs = empty ? 0 : Math.min(...allPhases.map((p) => p.startMs))

  return { connectionStart, requestResponse, totalMs, axisStartMs, empty }
}

function computeWallTotalMs(row: HttpRow): number | undefined {
  const end = row.finishedAt ?? row.failedAt
  if (end === undefined || row.startedAt === undefined) return undefined
  const delta = end - row.startedAt
  return delta >= 0 ? delta : undefined
}

function minDefined(values: Array<number | undefined>): number | undefined {
  let m: number | undefined
  for (const v of values) {
    if (v === undefined) continue
    if (m === undefined || v < m) m = v
  }
  return m
}

/**
 * Compact, auto-scaling duration formatter.
 *
 * Always up to 2 fractional digits, with trailing zeros stripped, and the
 * largest unit that keeps the integer part reasonable: µs → ms → s → m.
 *   500 µs · 1.23 ms · 20.93 ms · 1.5 s · 1m 30s · 1m 15.5s
 */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms === 0) return '0'
  if (ms < 0) return `-${formatMs(-ms)}`
  if (ms < 1) return `${stripTrailingZeros((ms * 1000).toFixed(2))} µs`
  if (ms < 1000) return `${stripTrailingZeros(ms.toFixed(2))} ms`
  if (ms < 60_000) return `${stripTrailingZeros((ms / 1000).toFixed(2))} s`
  return `${stripTrailingZeros((ms / 60_000).toFixed(2))} m`
}

function stripTrailingZeros(s: string): string {
  if (!s.includes('.')) return s
  let out = s.replace(/0+$/, '')
  if (out.endsWith('.')) out = out.slice(0, -1)
  return out
}
