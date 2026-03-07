/**
 * Content script — runs in ISOLATED world at document_start.
 *
 * Bridges the MAIN world hook (window.postMessage) and the extension
 * background service worker (chrome.runtime port).
 *
 * Compiled as standalone IIFE.
 */

;(function () {
  const HOOK_SOURCE = 'cqrs-hook'
  const CONTENT_SOURCE = 'cqrs-content'
  const PORT_CONTENT_SCRIPT = 'content-script'

  const MSG_ACTIVATE = 'cqrs-devtools-activate'

  let port: chrome.runtime.Port

  function connect(): void {
    port = chrome.runtime.connect({ name: PORT_CONTENT_SCRIPT })

    // Background → Content Script → Hook
    // Forward messages from background to the page hook via window.postMessage.
    port.onMessage.addListener((message: unknown) => {
      const msg = message as { type?: string } | undefined
      if (!msg?.type) return

      window.postMessage({ ...msg, source: CONTENT_SOURCE }, '*')
    })

    // MV3 service workers go idle and terminate, dropping the port.
    // Reconnect so event flow resumes when the worker wakes back up.
    // Re-activate the hook so it re-sends client-detected to the fresh worker.
    port.onDisconnect.addListener(() => {
      setTimeout(() => {
        connect()
        window.postMessage({ type: MSG_ACTIVATE, source: CONTENT_SOURCE }, '*')
      }, 500)
    })
  }

  connect()

  // Hook → Content Script → Background
  // Forward messages from the page hook to the background service worker.
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return
    const data = event.data as { source?: string } | undefined
    if (!data || data.source !== HOOK_SOURCE) return

    port.postMessage(data)
  })
})()
