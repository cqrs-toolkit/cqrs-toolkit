import type { Level } from '@meticoeus/ddd-es'
import { EventBusLogger } from '../adapters/worker-core/eventBusLogger.js'

/**
 * Shared logger instance used across vitest runs in this package (and
 * anywhere else that wires `logProvider` to it — notably `client-solid`).
 *
 * Unit tests get console-only output at `LOG_LEVEL` (default `warn`), so
 * the default noise level matches the previous `createConsoleLogger`
 * behaviour. Integration tests call {@link EventBusLogger.setSink | `setSink`}
 * at the start of each run with that run's fresh `EventBus` so log entries
 * land in the timeline dump on failure; the teardown sets it back to
 * `undefined` so a stale bus from the previous test never receives emissions.
 *
 * This is *test-only* infrastructure — app code constructs
 * {@link EventBusLogger} directly with its bus fixed for the process
 * lifetime.
 */
export const testEventBusLogger = new EventBusLogger(
  undefined,
  (process.env['LOG_LEVEL'] as Level | undefined) ?? 'warn',
)
