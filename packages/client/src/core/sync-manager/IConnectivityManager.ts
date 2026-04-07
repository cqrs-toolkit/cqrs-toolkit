import type { Link } from '@meticoeus/ddd-es'
import { Observable } from 'rxjs'

/**
 * WebSocket transport connection state.
 */
export type WsConnectionState = 'disconnected' | 'connecting' | 'connected'

/**
 * Connectivity state.
 */
export interface ConnectivityState {
  /** Whether the browser reports being online */
  network: 'online' | 'offline' | 'unknown'
  /** Whether we've confirmed API connectivity */
  serverReachable: 'yes' | 'no' | 'unknown'
  /** Last successful API contact timestamp */
  lastContact?: number
}

/**
 * Connectivity manager configuration.
 */
export interface ConnectivityManagerConfig {
  /** Interval to check API connectivity (ms) */
  checkInterval?: number
  /** API health check URL */
  healthCheckUrl?: string
}

/**
 * Consumer-facing connectivity interface.
 * Both the real ConnectivityManager (online-only / worker-internal) and
 * ConnectivityProxy (main-thread in worker modes) implement this.
 */
export interface IConnectivity {
  /** Get the current connectivity state. */
  getState(): ConnectivityState
  /** Observable of connectivity state changes. */
  readonly state: Observable<ConnectivityState>
  /** Observable of online status (browser + API reachable). */
  readonly online$: Observable<boolean>
  /** Check if we're effectively online. */
  isOnline(): boolean
}

/**
 * Internal connectivity management interface.
 * Used by SyncManager to control connectivity lifecycle and receive
 * signals from network operations. Extends the consumer-facing
 * IConnectivity with write methods.
 */
export interface IConnectivityManager<TLink extends Link> extends IConnectivity {
  /** Start monitoring connectivity. */
  start(): void
  /** Stop monitoring connectivity. */
  stop(): void
  /** Clean up resources. */
  destroy(): void
  /** Report successful API contact. */
  reportContact(): void
  /** Report API failure. */
  reportFailure(): void
  /** Report WebSocket connection state transition. */
  reportWsConnection(state: WsConnectionState): void
  /** Report WebSocket topics confirmed by the server. */
  reportWsSubscribed(topics: readonly string[]): void
}
