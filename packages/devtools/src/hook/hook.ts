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
        },
        '*',
      )

      if (active) {
        subscribe()
      }
    },
  }

  Object.defineProperty(window, DEVTOOLS_WINDOW_PROP, {
    value: hook,
    writable: false,
    configurable: false,
  })
})()
