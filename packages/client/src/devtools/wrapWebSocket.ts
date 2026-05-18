/**
 * Devtools hook bridge — pushes network events into the CQRS Toolkit
 * devtools panel when the extension is attached. No-op otherwise.
 *
 * Surface per docs/projects/devtools/decisions/0002-record-net-event-surface.md.
 * The toolkit (and user code) is the sole WS source; the extension
 * installs `__CQRS_TOOLKIT_DEVTOOLS__.recordNetEvent` in workers and
 * the page-side IIFE installs it on `window` — calls flow through that
 * single surface in every mode.
 */

const DEVTOOLS_GLOBAL = '__CQRS_TOOLKIT_DEVTOOLS__'

/**
 * Discriminated union of network observations a caller can push into the
 * devtools panel via `__CQRS_TOOLKIT_DEVTOOLS__.recordNetEvent`. Stable
 * `connectionId` ties frames to the lifecycle pair (`ws-created` opens,
 * `ws-closed` terminates).
 */
export type NetEventInput =
  | { kind: 'ws-created'; connectionId: string; url: string; protocols?: string[] }
  | {
      kind: 'ws-frame-sent'
      connectionId: string
      /** Connection URL — carried on every frame so the panel can render
       *  path/url even when `ws-created` was dropped (e.g. fired before
       *  the panel hook was attached). */
      url?: string
      payload: string | ArrayBuffer | ArrayBufferView
      timestamp?: number
    }
  | {
      kind: 'ws-frame-received'
      connectionId: string
      url?: string
      payload: string | ArrayBuffer | ArrayBufferView
      timestamp?: number
    }
  | {
      kind: 'ws-closed'
      connectionId: string
      code?: number
      reason?: string
      wasClean?: boolean
    }

interface DevtoolsHookSurface {
  recordNetEvent?: (event: NetEventInput) => void
}

function getHook(): DevtoolsHookSurface | undefined {
  // `globalThis` is typed as the sealed `typeof globalThis` and disallows
  // arbitrary string indexing. The devtools extension's content script
  // sets `__CQRS_TOOLKIT_DEVTOOLS__` from outside this package's type
  // graph, so we probe it via a widened view. Same pattern as `hasDevtools`
  // in `types/config.ts`.
  const g = globalThis as unknown as Record<string, unknown>
  const hook = g[DEVTOOLS_GLOBAL]
  if (typeof hook !== 'object' || hook === null) return undefined
  return hook as DevtoolsHookSurface
}

/**
 * Push a single network observation into the devtools panel if the
 * extension is attached. No-op if no hook is installed.
 *
 * Direct callers (custom transports, non-WebSocket protocols) use this.
 * For standard WebSockets, prefer `wrapWebSocket` — it wires the four
 * lifecycle events for you.
 */
export function recordNetEvent(event: NetEventInput): void {
  const hook = getHook()
  hook?.recordNetEvent?.(event)
}

interface WrapWebSocketOptions {
  connectionId: string
}

/**
 * Wire devtools observation on an existing `WebSocket`. Returns the same
 * socket so the call stays one line at the construction site:
 *
 * ```ts
 * const ws = wrapWebSocket(new WebSocket(url), { connectionId: 'cqrs-sync' })
 * ```
 */
export function wrapWebSocket(socket: WebSocket, opts: WrapWebSocketOptions): WebSocket {
  const { connectionId } = opts
  const url = socket.url
  recordNetEvent({ kind: 'ws-created', connectionId, url })

  const originalSend = socket.send.bind(socket)
  socket.send = function patchedSend(
    data: string | ArrayBufferLike | Blob | ArrayBufferView,
  ): void {
    if (isRecordablePayload(data)) {
      recordNetEvent({ kind: 'ws-frame-sent', connectionId, url, payload: data })
    }
    originalSend(data)
  }

  socket.addEventListener('message', (ev: MessageEvent) => {
    const data: unknown = ev.data
    if (isRecordablePayload(data)) {
      recordNetEvent({ kind: 'ws-frame-received', connectionId, url, payload: data })
    }
  })

  socket.addEventListener('close', (ev: CloseEvent) => {
    recordNetEvent({
      kind: 'ws-closed',
      connectionId,
      code: ev.code,
      reason: ev.reason,
      wasClean: ev.wasClean,
    })
  })

  return socket
}

function isRecordablePayload(data: unknown): data is string | ArrayBuffer | ArrayBufferView {
  if (typeof data === 'string') return true
  if (data instanceof ArrayBuffer) return true
  if (ArrayBuffer.isView(data)) return true
  // Blob deliberately omitted — reading requires async, and the toolkit
  // doesn't currently use Blob payloads. Push a stringified note via
  // `recordNetEvent` directly if blob support is needed.
  return false
}
