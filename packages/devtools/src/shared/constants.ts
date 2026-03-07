/**
 * Shared constants for the devtools extension message relay.
 */

/** Source tag for messages originating from the MAIN world hook. */
export const HOOK_SOURCE = 'cqrs-hook'

/** Source tag for messages originating from the ISOLATED content script. */
export const CONTENT_SOURCE = 'cqrs-content'

/** Window property name where the devtools hook is registered. */
export const DEVTOOLS_WINDOW_PROP = '__CQRS_TOOLKIT_DEVTOOLS__'

// ---------------------------------------------------------------------------
// Hook ↔ Content Script message types (window.postMessage)
// ---------------------------------------------------------------------------

/** Library client registered with the hook. */
export const MSG_CLIENT_DETECTED = 'cqrs-devtools-client-detected'

/** Library event forwarded from hook. */
export const MSG_EVENT = 'cqrs-devtools-event'

/** Full command snapshot from hook. */
export const MSG_COMMAND_SNAPSHOT = 'cqrs-devtools-command-snapshot'

/** Content script tells hook to start subscribing. */
export const MSG_ACTIVATE = 'cqrs-devtools-activate'

/** Content script tells hook to stop subscribing. */
export const MSG_DEACTIVATE = 'cqrs-devtools-deactivate'

/** Request a fresh command snapshot. */
export const MSG_REQUEST_COMMAND_SNAPSHOT = 'cqrs-devtools-request-command-snapshot'

/** Execute a command action (retry/cancel). */
export const MSG_ACTION = 'cqrs-devtools-action'

/** Request raw SQL execution against client storage. */
export const MSG_REQUEST_STORAGE = 'cqrs-devtools-request-storage'

/** Response from raw SQL execution. */
export const MSG_STORAGE_RESPONSE = 'cqrs-devtools-storage-response'

// ---------------------------------------------------------------------------
// Panel ↔ Background message types (chrome.runtime port)
// ---------------------------------------------------------------------------

/** Panel connected, carries tabId. */
export const MSG_PANEL_CONNECT = 'panel-connect'

/** Background dumps buffered events to newly connected panel. */
export const MSG_BUFFER_DUMP = 'buffer-dump'

/** Panel requests buffer clear. */
export const MSG_PANEL_CLEAR = 'panel-clear'

// ---------------------------------------------------------------------------
// Port names
// ---------------------------------------------------------------------------

/** Name for content-script → background port. */
export const PORT_CONTENT_SCRIPT = 'content-script'

/** Name for panel → background port. */
export const PORT_PANEL = 'panel'
