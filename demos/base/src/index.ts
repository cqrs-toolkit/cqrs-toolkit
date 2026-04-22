// Shared domain code for CQRS toolkit demos

import type { CqrsClient, LibraryEvent } from '@cqrs-toolkit/client'
import { onCleanup } from 'solid-js'

declare global {
  interface Window {
    /**
     * Library events captured from `client.events$` for Playwright
     * diagnostics. The fixture renders this via `formatEventBusTimeline`
     * on test failure. In debug mode this includes `debug:log` entries
     * from `logProvider.log.*` calls (main-thread or forwarded from the
     * worker), giving a single interleaved timeline.
     */
    __CQRS_EVENTS__: LibraryEvent<any>[]
  }
}

/**
 * Subscribe to `client.events$` and accumulate every emission on
 * `window.__CQRS_EVENTS__` so the Playwright `dumpCqrsEvents` fixture can
 * format a full timeline on failure. Call once from the app root.
 */
export function createDiagnostics(client: CqrsClient<any, any>): void {
  if (!window.__CQRS_EVENTS__) {
    window.__CQRS_EVENTS__ = []
  }

  const sub = client.events$.subscribe((event) => {
    window.__CQRS_EVENTS__.push(event)
  })

  onCleanup(() => sub.unsubscribe())
}
