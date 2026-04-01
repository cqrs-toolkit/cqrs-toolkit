import {
  createCqrsClient,
  detectMode,
  EnqueueCommand,
  type CqrsClient,
  type ExecutionMode,
  type ExecutionModeConfig,
} from '@cqrs-toolkit/client'
import { ServiceLink } from '@meticoeus/ddd-es'
import DedicatedWorkerUrl from '../workers/dedicated-worker?worker&url'
import SharedWorkerUrl from '../workers/shared-worker?worker&url'
import SqliteWorkerUrl from '../workers/sqlite-worker?worker&url'
import { cqrsConfig } from './cqrs-config.js'

const VALID_MODES = new Set<ExecutionModeConfig>([
  'auto',
  'online-only',
  'shared-worker',
  'dedicated-worker',
])

interface EntryOptions {
  mode: ExecutionModeConfig
  /** @default true - enable WebSocket sync */
  ws: boolean
  /** @default true - retain commands */
  cr: boolean
}

export const options: EntryOptions = resolveEntryOptions()

function resolveEntryOptions(): EntryOptions {
  const params = new URLSearchParams(window.location.search)
  return {
    mode: resolveMode(params.get('mode')),
    ws: params.get('ws') !== 'false',
    cr: params.get('cr') !== 'false',
  }
}

function resolveMode(raw: string | null): ExecutionModeConfig {
  const requested: ExecutionModeConfig = VALID_MODES.has(raw as ExecutionModeConfig)
    ? (raw as ExecutionModeConfig)
    : 'auto'

  // For explicit worker modes, pre-flight check that the APIs exist.
  // For 'auto', the library handles detection and fallback.
  if (requested !== 'auto') {
    assertModeSupported(requested)
  }

  return requested
}

/**
 * Assert that the requested mode is supported in the current environment.
 *
 * When a specific mode is requested via `?mode=`, it must be available — silent
 * degradation would produce false-positive test results. The library's own fallback
 * behavior is unaffected because it uses `auto`/`detectMode()`.
 */
function assertModeSupported(requested: ExecutionMode): void {
  switch (requested) {
    case 'shared-worker':
      if (typeof SharedWorker === 'undefined') {
        throw new Error(
          `Requested mode "shared-worker" but SharedWorker is not available in this environment.` +
            ` Use ?mode=auto to let the library pick the best available mode.`,
        )
      }
      return
    case 'dedicated-worker':
      if (typeof Worker === 'undefined') {
        throw new Error(
          `Requested mode "dedicated-worker" but Worker is not available in this environment.` +
            ` Use ?mode=auto to let the library pick the best available mode.`,
        )
      }
      if (typeof navigator.storage?.getDirectory !== 'function') {
        throw new Error(
          `Requested mode "dedicated-worker" but OPFS is not available in this environment.` +
            ` Worker modes require OPFS for SQLite persistence.` +
            ` Use ?mode=auto to let the library pick the best available mode.`,
        )
      }
      return
    case 'online-only':
      return
  }
}

function workerUrlForMode(mode: ExecutionMode): string | undefined {
  switch (mode) {
    case 'dedicated-worker':
      return DedicatedWorkerUrl
    case 'shared-worker':
      return SharedWorkerUrl
    case 'online-only':
      return undefined
  }
}

// ---------------------------------------------------------------------------
// Client initialization
// ---------------------------------------------------------------------------

export async function initializeClient(): Promise<CqrsClient<ServiceLink, EnqueueCommand>> {
  const requestedMode = options.mode

  // For 'auto', detectMode() picks the worker URL; for explicit modes, use as-is.
  const detectedMode = requestedMode === 'auto' ? detectMode() : requestedMode

  const client = await createCqrsClient({
    ...cqrsConfig,
    mode: requestedMode,
    workerUrl: workerUrlForMode(detectedMode),
    sqliteWorkerUrl: SqliteWorkerUrl,
    // Override network for main-thread concerns
    network: {
      ...cqrsConfig.network,
      // ws=false disables WebSocket in online-only mode (testing convenience).
      // Worker modes always use WS (the worker owns the connection).
      wsUrl: options.ws ? cqrsConfig.network.wsUrl : undefined,
    },
    retainTerminal: options.cr,
  })

  // Explicit mode must match — silent degradation would produce false-positive test results.
  // For 'auto', degradation is expected and the mode badge shows what actually happened.
  if (requestedMode !== 'auto' && client.mode !== requestedMode) {
    await client.close()
    const msg = `Mode mismatch: requested "${requestedMode}" but initialized as "${client.mode}"`
    document.body.innerHTML = `<div class="mode-mismatch-error">${msg}</div>`
    throw new Error(msg)
  }

  return client
}
