/**
 * Canonical formatter for EventBus timelines printed on test failure.
 *
 * The integration harnesses in `@cqrs-toolkit/client` and
 * `@cqrs-toolkit/client-solid` subscribe to `eventBus.events$` with
 * `eventBus.debug = true` and accumulate every emitted event. When a test
 * fails (or the internal timeout fires), they call {@link formatEventBusTimeline}
 * to render the captured timeline as a single human-readable block that gets
 * logged alongside the failure.
 *
 * Because the worker and main thread both route `logProvider.log.*` calls
 * through the `debug:log` event (via {@link EventBusLogger}), the timeline
 * interleaves library events and log lines in emission order — which is
 * usually what you want when diagnosing why a test got stuck.
 *
 * `debug:log` events are rendered like log lines (`[DEBUG]  message  {data}`);
 * all other events keep the event-bus shape (`type  {data}`). `bigint` values
 * serialize to strings so event revisions/positions don't crash JSON.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { LibraryEvent } from '../../types/events.js'

export function formatEventBusTimeline<TLink extends Link>(
  events: readonly LibraryEvent<TLink>[],
): string {
  const lines = events.map((event, i) => formatLine(event, i))
  return (
    `\n─── EventBus timeline (${events.length} events) ───\n` +
    lines.join('\n') +
    '\n─── end timeline ───\n'
  )
}

function formatLine<TLink extends Link>(event: LibraryEvent<TLink>, index: number): string {
  const idx = String(index).padStart(3)
  const ts = new Date(event.timestamp).toISOString().slice(11, 23)
  if (event.type === 'debug:log') {
    return formatDebugLog(idx, ts, event.data)
  }
  const flag = event.debug ? ' [debug]' : ''
  return `${idx}  ${ts}${flag}  ${event.type}  ${safeJson(event.data)}`
}

function formatDebugLog(idx: string, ts: string, data: unknown): string {
  const record = isRecord(data) ? data : {}
  const { level, message, ...rest } = record
  const levelTag = typeof level === 'string' ? `[${level.toUpperCase()}]` : '[LOG]'
  const msg = typeof message === 'string' ? message : ''
  const restPart = Object.keys(rest).length > 0 ? `  ${safeJson(rest)}` : ''
  return `${idx}  ${ts}  ${levelTag}  ${msg}${restPart}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  } catch {
    return '<unserializable>'
  }
}
