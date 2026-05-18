/**
 * Message protocol types for the devtools extension.
 *
 * Messages flow through four contexts:
 *   Page (MAIN world hook) → Content Script (ISOLATED) → Background → Panel
 *
 * All type imports from @cqrs-toolkit/client are `import type` — erased at compile.
 */

import type { ClientMode, CommandRecord, CommandStatus, EnqueueCommand } from '@cqrs-toolkit/client'
import type { ServiceLink } from '@meticoeus/ddd-es'
import type {
  MSG_ACTION,
  MSG_ACTIVATE,
  MSG_BUFFER_DUMP,
  MSG_CLIENT_DETECTED,
  MSG_COMMAND_SNAPSHOT,
  MSG_DEACTIVATE,
  MSG_EVENT,
  MSG_NET_CAPTURE_START,
  MSG_NET_CAPTURE_STATE,
  MSG_NET_CAPTURE_STOP,
  MSG_NET_EVENT,
  MSG_PANEL_CLEAR,
  MSG_PANEL_CONNECT,
  MSG_REQUEST_STORAGE,
  MSG_STORAGE_RESPONSE,
} from './constants.js'

// ---------------------------------------------------------------------------
// Serialized config (safe for chrome.runtime.Port / window.postMessage)
// ---------------------------------------------------------------------------

/** Subset of ResolvedConfig safe for transfer (no functions, no bigint). */
export interface SerializedConfig {
  debug: boolean
  retainTerminal: boolean
  network: { baseUrl: string; wsUrl?: string; timeout?: number }
  storage: { dbName?: string }
  retry: { maxAttempts?: number; initialDelay?: number; maxDelay?: number }
  cache: { maxCacheKeys?: number; defaultTtl?: number; evictionPolicy?: string }
  collections: string[]
}

// ---------------------------------------------------------------------------
// Hook → Content Script (window.postMessage)
// ---------------------------------------------------------------------------

/** Re-exported from `@cqrs-toolkit/client` so devtools-internal consumers
 *  don't have to reach across the package boundary for each usage. */
export type { ClientMode }

export interface ClientDetectedMessage {
  type: typeof MSG_CLIENT_DETECTED
  source: 'cqrs-hook'
  config: SerializedConfig
  role: 'leader' | 'standby'
  mode: ClientMode
  /** Consumer-configured worker URL; absent in `'online-only'` mode. */
  workerUrl?: string
}

export interface EventMessage {
  type: typeof MSG_EVENT
  source: 'cqrs-hook'
  event: SanitizedEvent
}

export interface CommandSnapshotMessage {
  type: typeof MSG_COMMAND_SNAPSHOT
  source: 'cqrs-hook'
  commands: SerializedCommandRecord[]
}

/**
 * Network observation pushed from the page-side hook (library `recordNetEvent`
 * calls, including `wrapWebSocket`-wired toolkit WebSockets). Same payload
 * shape as the background → panel `NetEventMessage`, but with the
 * `source: 'cqrs-hook'` tag the content-script bridge filters on.
 */
export interface HookNetEventMessage {
  type: typeof MSG_NET_EVENT
  source: 'cqrs-hook'
  event: NetworkProbeEvent
}

// ---------------------------------------------------------------------------
// Content Script → Hook (window.postMessage)
// ---------------------------------------------------------------------------

export interface ActivateMessage {
  type: typeof MSG_ACTIVATE
  source: 'cqrs-content'
}

export interface DeactivateMessage {
  type: typeof MSG_DEACTIVATE
  source: 'cqrs-content'
}

export interface ActionMessage {
  type: typeof MSG_ACTION
  source: 'cqrs-content'
  action: 'retry' | 'cancel'
  commandId: string
}

export interface RequestStorageMessage {
  type: typeof MSG_REQUEST_STORAGE
  source: 'cqrs-content'
  sql: string
  bind?: unknown[]
  requestId: string
}

export interface StorageResponseMessage {
  type: typeof MSG_STORAGE_RESPONSE
  source: 'cqrs-hook'
  requestId: string
  rows: Record<string, unknown>[]
  error?: string
}

// ---------------------------------------------------------------------------
// Panel ↔ Background (chrome.runtime port)
// ---------------------------------------------------------------------------

export interface PanelConnectMessage {
  type: typeof MSG_PANEL_CONNECT
  tabId: number
}

export interface BufferDumpMessage {
  type: typeof MSG_BUFFER_DUMP
  config: SerializedConfig | undefined
  role: 'leader' | 'standby' | undefined
  mode: ClientMode | undefined
  workerUrl: string | undefined
  events: SanitizedEvent[]
  commands: SerializedCommandRecord[]
}

export interface PanelClearMessage {
  type: typeof MSG_PANEL_CLEAR
}

// ---------------------------------------------------------------------------
// Unions
// ---------------------------------------------------------------------------

/** Messages from hook (MAIN world) to content script. */
export type HookMessage =
  | ClientDetectedMessage
  | EventMessage
  | CommandSnapshotMessage
  | StorageResponseMessage
  | HookNetEventMessage

/** Messages from content script to hook. */
export type ContentToHookMessage =
  | ActivateMessage
  | DeactivateMessage
  | ActionMessage
  | RequestStorageMessage

/** Messages from panel to background. */
export type PanelToBackgroundMessage =
  | PanelConnectMessage
  | PanelClearMessage
  | ActionMessage
  | RequestStorageMessage
  | NetCaptureStartMessage
  | NetCaptureStopMessage

/** Messages from background to panel. */
export type BackgroundToPanelMessage =
  | BufferDumpMessage
  | ClientDetectedMessage
  | EventMessage
  | CommandSnapshotMessage
  | StorageResponseMessage
  | NetEventMessage
  | NetCaptureStateMessage

// ---------------------------------------------------------------------------
// Network capture (probe) — Panel ↔ Background
// ---------------------------------------------------------------------------

export interface NetCaptureStartMessage {
  type: typeof MSG_NET_CAPTURE_START
  /** Origin of the inspected page, evaluated client-side. Used to scope
   *  SharedWorker discovery so we don't attach to unrelated browser-wide
   *  workers. */
  origin: string
  /**
   * Execution mode reported by the client. Drives the start behaviour:
   *   - `'online-only'` — no debugger attach (page hook + HAR covers all),
   *   - `'dedicated-worker'` — attach to dedicated workers for hook
   *     injection only (HAR still owns HTTP),
   *   - `'shared-worker'` — attach to the SharedWorker for hook injection
   *     and CDP `Network` for HTTP (HAR can't see the SW process).
   * If undefined (client not yet detected), capture surfaces an error so
   * the panel knows to wait for the library to register.
   */
  mode?: ClientMode
}

export interface NetCaptureStopMessage {
  type: typeof MSG_NET_CAPTURE_STOP
}

export interface NetEventMessage {
  type: typeof MSG_NET_EVENT
  event: NetworkProbeEvent
}

export type NetCaptureState =
  | { status: 'idle' }
  | { status: 'attaching' }
  | { status: 'capturing' }
  | { status: 'error'; reason: string }
  | { status: 'detached'; reason: string }
  /**
   * Another debugger client (typically a second DevTools instance opened on
   * the same browser) already owns the SharedWorker target. The panel renders
   * a banner; other tabs in the toolkit panel keep working because they use
   * the library hook, not chrome.debugger.
   */
  | { status: 'conflict'; reason: string }

export interface NetCaptureStateMessage {
  type: typeof MSG_NET_CAPTURE_STATE
  state: NetCaptureState
}

/**
 * Snapshot of which CDP session a probe event came from.
 * Empty `sessionId` means the root tab session.
 */
export interface NetSessionInfo {
  sessionId: string
  targetType: string
  targetUrl: string
  targetId?: string
}

interface NetEventBase {
  /** sessionId + ':' + requestId — globally unique across worker sessions. */
  recordId: string
  /** CDP requestId (only unique within a session). */
  requestId: string
  /** Session the event arrived on. */
  session: NetSessionInfo
  /** CDP monotonic time, seconds. */
  cdpTimestamp: number
  /** Wall-clock time at receipt in the background, epoch ms. */
  wallTime: number
}

export interface NetEventRequestWillBeSent extends NetEventBase {
  kind: 'request-will-be-sent'
  url: string
  method: string
  headers: Record<string, string>
  hasPostData: boolean
  postDataPreview?: string
  resourceType?: string
  initiatorType?: string
  initiatorUrl?: string
}

export interface NetEventResponseReceived extends NetEventBase {
  kind: 'response-received'
  url: string
  status: number
  statusText: string
  headers: Record<string, string>
  mimeType: string
  resourceType?: string
  remoteIpAddress?: string
  remotePort?: number
  fromDiskCache?: boolean
  fromServiceWorker?: boolean
  encodedDataLength?: number
  /** CDP-format timing breakdown if present (dns/connect/ssl/send/wait/receive). */
  timing?: Record<string, number>
}

export interface NetEventLoadingFinished extends NetEventBase {
  kind: 'loading-finished'
  encodedDataLength: number
}

export interface NetEventResponseBody extends NetEventBase {
  kind: 'response-body'
  /** Body string. If base64Encoded is true, the original bytes are binary. */
  body: string
  base64Encoded: boolean
  /** True if the body was clipped before forwarding to keep the message small. */
  truncated: boolean
}

export interface NetEventLoadingFailed extends NetEventBase {
  kind: 'loading-failed'
  resourceType?: string
  errorText: string
  canceled?: boolean
  blockedReason?: string
}

export interface NetEventWebSocketCreated extends NetEventBase {
  kind: 'ws-created'
  url: string
  initiatorUrl?: string
}

export interface NetEventWebSocketFrame extends NetEventBase {
  kind: 'ws-frame-sent' | 'ws-frame-received'
  opcode: number
  mask: boolean
  payloadSize: number
  payloadPreview?: string
  /** Connection URL when the source knows it (library-callable
   *  `recordNetEvent`, injected worker patch). Absent for CDP-native
   *  `Network.webSocketFrame*` events — those rely on the panel's
   *  `wsUrlByConnection` lookup populated from a paired `ws-created`. */
  url?: string
}

export interface NetEventWebSocketClosed extends NetEventBase {
  kind: 'ws-closed'
}

export interface NetEventTargetAttached {
  kind: 'target-attached'
  session: NetSessionInfo
  cdpTimestamp: number
  wallTime: number
  waitingForDebugger: boolean
}

export interface NetEventTargetDetached {
  kind: 'target-detached'
  session: NetSessionInfo
  cdpTimestamp: number
  wallTime: number
}

export type NetworkProbeEvent =
  | NetEventRequestWillBeSent
  | NetEventResponseReceived
  | NetEventLoadingFinished
  | NetEventLoadingFailed
  | NetEventResponseBody
  | NetEventWebSocketCreated
  | NetEventWebSocketFrame
  | NetEventWebSocketClosed
  | NetEventTargetAttached
  | NetEventTargetDetached

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/**
 * A library event with BigInt values converted to strings.
 * Safe for JSON-based postMessage serialization.
 */
export interface SanitizedEvent {
  type: string
  data: Record<string, unknown>
  timestamp: number
  debug?: boolean
}

/**
 * Serialized command record — mirrors CommandRecord but with all values
 * safe for structured clone / JSON transfer.
 */
export type SerializedCommandRecord = CommandRecord<ServiceLink, EnqueueCommand>

/**
 * Subset of CommandStatus values used for filter chips.
 */
export type FilterableCommandStatus = CommandStatus
