/**
 * Connectivity manager tracks network status.
 */

import { type Link, logProvider } from '@meticoeus/ddd-es'
import { BehaviorSubject, Subscription, fromEvent, map, merge, startWith } from 'rxjs'
import type { EventBus } from '../events/EventBus.js'
import {
  AbstractConnectivityManager,
  type ConnectivityManagerConfig,
} from './AbstractConnectivityManager.js'
import type { ConnectivityState } from './IConnectivityManager.js'

/**
 * Browser connectivity manager.
 * Tracks navigator.onLine status and API reachability via health checks.
 */
export class ConnectivityManager<TLink extends Link> extends AbstractConnectivityManager<TLink> {
  private browserSub: Subscription | undefined

  constructor(eventBus: EventBus<TLink>, config: ConnectivityManagerConfig = {}) {
    super(
      eventBus,
      new BehaviorSubject<ConnectivityState>({
        network:
          typeof navigator !== 'undefined' ? (navigator.onLine ? 'online' : 'offline') : 'unknown',
        serverReachable: 'unknown',
      }),
      config,
    )
  }

  /**
   * Start monitoring connectivity.
   */
  override start(): void {
    // Guard: skip in non-browser environments (Node.js / SSR).
    // Workers lack `window` but have navigator.onLine and online/offline events on `self`.
    if (typeof navigator === 'undefined' || !('onLine' in navigator)) return

    // `self` refers to the global scope in both window and worker contexts.
    // Both Window and WorkerGlobalScope support online/offline events.
    const online$ = fromEvent(self, 'online').pipe(map(() => true))
    const offline$ = fromEvent(self, 'offline').pipe(map(() => false))

    this.browserSub = merge(online$, offline$)
      .pipe(startWith(navigator.onLine))
      .subscribe((online) => {
        this.updateState({ network: online ? 'online' : 'offline' })

        if (online) {
          // Try to verify API connectivity
          this.checkApiConnectivity().catch((err) => {
            logProvider.log.error({ err }, 'API connectivity check failed')
          })
        }
      })

    // Periodic API connectivity check
    if (this.healthCheckUrl) {
      this.checkTimer = setInterval(() => {
        if (this.state$.getValue().network === 'online') {
          this.checkApiConnectivity().catch((err) => {
            logProvider.log.error({ err }, 'API connectivity check failed')
          })
        }
      }, this.checkInterval)

      // Initial check
      this.checkApiConnectivity().catch((err) => {
        logProvider.log.error({ err }, 'API connectivity check failed')
      })
    } else {
      // No health check URL - assume API is reachable when browser is online
      this.updateState({ serverReachable: navigator.onLine ? 'yes' : 'no' })
    }
  }

  /**
   * Stop monitoring connectivity.
   */
  override stop(): void {
    if (this.browserSub) {
      this.browserSub.unsubscribe()
      this.browserSub = undefined
    }
    super.stop()
  }
}
