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

  const MSG_DEACTIVATE = 'cqrs-devtools-deactivate'

  const port = chrome.runtime.connect({ name: PORT_CONTENT_SCRIPT })

  // Hook → Content Script → Background
  // Forward messages from the page hook to the background service worker.
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return
    const data = event.data as { source?: string } | undefined
    if (!data || data.source !== HOOK_SOURCE) return

    port.postMessage(data)
  })

  // Background → Content Script → Hook
  // Forward messages from background to the page hook via window.postMessage.
  port.onMessage.addListener((message: unknown) => {
    const msg = message as { type?: string } | undefined
    if (!msg?.type) return

    window.postMessage({ ...msg, source: CONTENT_SOURCE }, '*')
  })

  // When the background port disconnects, tell the hook to deactivate.
  port.onDisconnect.addListener(() => {
    window.postMessage({ type: MSG_DEACTIVATE, source: CONTENT_SOURCE }, '*')
  })
})()
