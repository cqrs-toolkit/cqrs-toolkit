/**
 * Node.js-compatible connectivity manager for Electron's utility process.
 *
 * The browser ConnectivityManager relies on navigator.onLine and
 * online/offline DOM events which don't exist in Node.js. This
 * implementation assumes the network is always available at the OS level
 * and uses a periodic health check to determine server reachability.
 */

import type { ConnectivityManagerConfig, ConnectivityState, EventBus } from '@cqrs-toolkit/client'
import { AbstractConnectivityManager } from '@cqrs-toolkit/client/internals'
import type { Link } from '@meticoeus/ddd-es'
import { logProvider } from '@meticoeus/ddd-es'
import { BehaviorSubject } from 'rxjs'

export class NodeConnectivityManager<
  TLink extends Link,
> extends AbstractConnectivityManager<TLink> {
  constructor(eventBus: EventBus<TLink>, config: ConnectivityManagerConfig = {}) {
    super(
      eventBus,
      new BehaviorSubject<ConnectivityState>({
        network: 'online',
        serverReachable: 'unknown',
      }),
      config,
    )
  }

  /**
   * Start monitoring connectivity.
   */
  override start(): void {
    if (this.healthCheckUrl) {
      // Initial check
      this.checkApiConnectivity().catch((err) => {
        logProvider.log.error({ err }, 'API connectivity check failed')
      })

      // Periodic checks
      this.checkTimer = setInterval(() => {
        this.checkApiConnectivity().catch((err) => {
          logProvider.log.error({ err }, 'API connectivity check failed')
        })
      }, this.checkInterval)
    } else {
      // No health check URL — assume reachable
      this.updateState({ serverReachable: 'yes' })
    }
  }
}
