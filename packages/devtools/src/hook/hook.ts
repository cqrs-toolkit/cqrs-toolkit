/**
 * DevTools hook — injected into the MAIN world at document_start.
 *
 * Sets up `window.__CQRS_TOOLKIT_DEVTOOLS__` so the library can register its
 * debug API. Bridges page ↔ content script via window.postMessage.
 *
 * Compiled as standalone IIFE — no module imports at runtime.
 * Uses duck-typed interfaces; does not import from @cqrs-toolkit/client.
 */

;(function () {
  const HOOK_SOURCE = 'cqrs-hook'
  const CONTENT_SOURCE = 'cqrs-content'
  const DEVTOOLS_WINDOW_PROP = '__CQRS_TOOLKIT_DEVTOOLS__'

  const MSG_CLIENT_DETECTED = 'cqrs-devtools-client-detected'
  const MSG_EVENT = 'cqrs-devtools-event'
  const MSG_COMMAND_SNAPSHOT = 'cqrs-devtools-command-snapshot'
  const MSG_ACTIVATE = 'cqrs-devtools-activate'
  const MSG_DEACTIVATE = 'cqrs-devtools-deactivate'
  const MSG_ACTION = 'cqrs-devtools-action'
  const MSG_REQUEST_STORAGE = 'cqrs-devtools-request-storage'
  const MSG_STORAGE_RESPONSE = 'cqrs-devtools-storage-response'
  const MSG_NET_EVENT = 'net-event'

  /** Bytes of payload preview forwarded for each frame; mirrors the CDP path. */
  const PAYLOAD_PREVIEW_BYTES = 1024

  // Duck-typed API shape (matches CqrsDebugAPI)
  interface DebugAPI {
    events$: { subscribe(observer: { next(event: unknown): void }): { unsubscribe(): void } }
    commandQueue: {
      listCommands(filter?: unknown): Promise<unknown[]>
      retryCommand(commandId: string): Promise<void>
      cancelCommand(commandId: string): Promise<void>
    }
    debugStorage?: { exec(sql: string, bind?: unknown[]): Promise<unknown> }
    config: Record<string, unknown>
    role: 'leader' | 'standby'
    mode: 'online-only' | 'dedicated-worker' | 'shared-worker'
    workerUrl?: string
  }

  // Duck-typed input shape — matches `NetEventInput` in
  // packages/client/src/devtools/wrapWebSocket.ts. Kept inline since the
  // hook IIFE doesn't import from @cqrs-toolkit/client.
  type NetEventInput =
    | { kind: 'ws-created'; connectionId: string; url: string; protocols?: string[] }
    | {
        kind: 'ws-frame-sent'
        connectionId: string
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

  let api: DebugAPI | undefined
  let active = false
  let subscription: { unsubscribe(): void } | undefined

  /**
   * Recursively sanitize a value for structured clone / JSON transfer.
   * Converts BigInt → string, strips functions and symbols.
   */
  function sanitizeForTransfer(value: unknown): unknown {
    if (typeof value === 'bigint') return value.toString()
    if (typeof value === 'function' || typeof value === 'symbol') return undefined
    if (value === null || value === undefined) return value
    if (typeof value !== 'object') return value

    if (Array.isArray(value)) {
      return value.map(sanitizeForTransfer)
    }

    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const sanitized = sanitizeForTransfer((value as Record<string, unknown>)[key])
      if (sanitized !== undefined) {
        result[key] = sanitized
      }
    }
    return result
  }

  function serializeConfig(config: Record<string, unknown>): Record<string, unknown> {
    const network = config['network'] as Record<string, unknown> | undefined
    const storage = config['storage'] as Record<string, unknown> | undefined
    const retry = config['retry'] as Record<string, unknown> | undefined
    const cache = config['cache'] as Record<string, unknown> | undefined
    const collections = config['collections'] as Array<{ name: string }> | undefined

    return {
      debug: config['debug'] ?? false,
      retainTerminal: config['retainTerminal'] ?? false,
      network: {
        baseUrl: network?.['baseUrl'] ?? '',
        wsUrl: network?.['wsUrl'],
        timeout: network?.['timeout'],
      },
      storage: { dbName: storage?.['dbName'] },
      retry: {
        maxAttempts: retry?.['maxAttempts'],
        initialDelay: retry?.['initialDelay'],
        maxDelay: retry?.['maxDelay'],
      },
      cache: {
        maxCacheKeys: cache?.['maxCacheKeys'],
        defaultTtl: cache?.['defaultTtl'],
        evictionPolicy: cache?.['evictionPolicy'],
      },
      collections: collections?.map((c) => c.name) ?? [],
    }
  }

  function subscribe(): void {
    if (!api || subscription) return

    subscription = api.events$.subscribe({
      next(event: unknown) {
        window.postMessage(
          {
            type: MSG_EVENT,
            source: HOOK_SOURCE,
            event: sanitizeForTransfer(event),
          },
          '*',
        )
      },
    })

    // Send initial command snapshot
    sendCommandSnapshot()
  }

  function unsubscribe(): void {
    if (subscription) {
      subscription.unsubscribe()
      subscription = undefined
    }
  }

  function sendCommandSnapshot(): void {
    if (!api) return
    api.commandQueue.listCommands().then((commands) => {
      window.postMessage(
        {
          type: MSG_COMMAND_SNAPSHOT,
          source: HOOK_SOURCE,
          commands: sanitizeForTransfer(commands),
        },
        '*',
      )
    })
  }

  // Listen for messages from content script
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return
    const data = event.data as
      | {
          type?: string
          source?: string
          action?: string
          commandId?: string
          requestId?: string
        }
      | undefined
    if (!data || data.source !== CONTENT_SOURCE) return

    switch (data.type) {
      case MSG_ACTIVATE:
        active = true
        if (api) subscribe()
        break

      case MSG_DEACTIVATE:
        active = false
        unsubscribe()
        break

      case MSG_ACTION:
        if (api && data.action && data.commandId) {
          if (data.action === 'retry') {
            api.commandQueue.retryCommand(data.commandId)
          } else if (data.action === 'cancel') {
            api.commandQueue.cancelCommand(data.commandId)
          }
        }
        break

      case MSG_REQUEST_STORAGE:
        if (api?.debugStorage && data.requestId) {
          const storageData = data as {
            requestId: string
            sql: string
            bind?: unknown[]
          }
          api.debugStorage
            .exec(storageData.sql, storageData.bind)
            .then((rows) => {
              window.postMessage(
                {
                  type: MSG_STORAGE_RESPONSE,
                  source: HOOK_SOURCE,
                  requestId: storageData.requestId,
                  rows: sanitizeForTransfer(rows),
                },
                '*',
              )
            })
            .catch((err: unknown) => {
              window.postMessage(
                {
                  type: MSG_STORAGE_RESPONSE,
                  source: HOOK_SOURCE,
                  requestId: storageData.requestId,
                  rows: [],
                  error: err instanceof Error ? err.message : String(err),
                },
                '*',
              )
            })
        }
        break
    }
  })

  function utf8ByteLength(s: string): number {
    let bytes = 0
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i)
      if (c < 0x80) bytes += 1
      else if (c < 0x800) bytes += 2
      else if (c >= 0xd800 && c <= 0xdbff) {
        bytes += 4
        i++
      } else bytes += 3
    }
    return bytes
  }

  function bytesToHexPeek(bytes: Uint8Array): string {
    const chunks: string[] = []
    const cap = Math.min(bytes.length, 8)
    for (let i = 0; i < cap; i++) {
      const b = bytes[i]
      if (b === undefined) break
      chunks.push(b.toString(16).padStart(2, '0'))
    }
    return chunks.join(' ')
  }

  function previewForBinary(view: Uint8Array): string {
    const size = view.byteLength
    if (size === 0) return '[binary]'
    const peek = bytesToHexPeek(view)
    return size > 8 ? `[binary, ${size} B] ${peek} …` : `[binary, ${size} B] ${peek}`
  }

  function pageSession(): {
    sessionId: string
    targetType: string
    targetUrl: string
    targetId: undefined
  } {
    return {
      sessionId: '',
      targetType: 'page',
      targetUrl: location.origin,
      targetId: undefined,
    }
  }

  /**
   * Project a library-source NetEventInput into the same NetworkProbeEvent
   * shape the CDP path produces. `recordId` is namespaced as
   * `library:<connectionId>` so library and CDP rows never collide on key.
   */
  function projectNetEvent(input: NetEventInput): Record<string, unknown> | undefined {
    const session = pageSession()
    const recordId = `library:${input.connectionId}`
    const base = {
      recordId,
      requestId: input.connectionId,
      session,
      cdpTimestamp: 0,
      wallTime: Date.now(),
    }

    if (input.kind === 'ws-created') {
      return { ...base, kind: 'ws-created', url: input.url }
    }
    if (input.kind === 'ws-closed') {
      return { ...base, kind: 'ws-closed' }
    }
    // Frame variants — normalise payload to size + preview, carry url for
    // the panel's URL/Path columns even when ws-created was dropped pre-attach.
    const payload = input.payload
    const url = input.url
    if (typeof payload === 'string') {
      const preview =
        payload.length > PAYLOAD_PREVIEW_BYTES ? payload.slice(0, PAYLOAD_PREVIEW_BYTES) : payload
      return {
        ...base,
        kind: input.kind,
        opcode: 1,
        mask: false,
        payloadSize: utf8ByteLength(payload),
        payloadPreview: preview,
        url,
      }
    }
    let view: Uint8Array
    if (payload instanceof ArrayBuffer) {
      view = new Uint8Array(payload)
    } else if (ArrayBuffer.isView(payload)) {
      view = new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength)
    } else {
      return undefined
    }
    return {
      ...base,
      kind: input.kind,
      opcode: 2,
      mask: false,
      payloadSize: view.byteLength,
      payloadPreview: previewForBinary(view),
      url,
    }
  }

  function recordNetEvent(input: NetEventInput): void {
    if (!active) return
    if (!input || typeof input !== 'object') return
    const probe = projectNetEvent(input)
    if (!probe) return
    window.postMessage(
      {
        type: MSG_NET_EVENT,
        source: HOOK_SOURCE,
        event: probe,
      },
      '*',
    )
  }

  // Register the hook on window
  const hook = {
    registerClient(debugApi: DebugAPI): void {
      api = debugApi

      const serializedConfig = serializeConfig(debugApi.config)
      window.postMessage(
        {
          type: MSG_CLIENT_DETECTED,
          source: HOOK_SOURCE,
          config: serializedConfig,
          role: debugApi.role,
          mode: debugApi.mode,
          workerUrl: debugApi.workerUrl,
        },
        '*',
      )

      if (active) {
        subscribe()
      }
    },
    recordNetEvent,
  }

  Object.defineProperty(window, DEVTOOLS_WINDOW_PROP, {
    value: hook,
    writable: false,
    configurable: false,
  })
})()
