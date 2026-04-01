/**
 * Message protocol types for the devtools extension.
 *
 * Messages flow through four contexts:
 *   Page (MAIN world hook) → Content Script (ISOLATED) → Background → Panel
 *
 * All type imports from @cqrs-toolkit/client are `import type` — erased at compile.
 */

import type { CommandRecord, CommandStatus, EnqueueCommand } from '@cqrs-toolkit/client'
import type { ServiceLink } from '@meticoeus/ddd-es'
import type {
  MSG_ACTION,
  MSG_ACTIVATE,
  MSG_BUFFER_DUMP,
  MSG_CLIENT_DETECTED,
  MSG_COMMAND_SNAPSHOT,
  MSG_DEACTIVATE,
  MSG_EVENT,
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

export interface ClientDetectedMessage {
  type: typeof MSG_CLIENT_DETECTED
  source: 'cqrs-hook'
  config: SerializedConfig
  role: 'leader' | 'standby'
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

/** Messages from background to panel. */
export type BackgroundToPanelMessage =
  | BufferDumpMessage
  | ClientDetectedMessage
  | EventMessage
  | CommandSnapshotMessage
  | StorageResponseMessage

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
