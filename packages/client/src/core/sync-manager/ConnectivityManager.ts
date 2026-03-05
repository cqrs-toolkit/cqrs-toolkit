/**
 * Connectivity manager tracks network status.
 */

import { logProvider } from '@meticoeus/ddd-es'
import {
  BehaviorSubject,
  Observable,
  Subscription,
  distinctUntilChanged,
  fromEvent,
  map,
  merge,
  startWith,
} from 'rxjs'
import type { EventBus } from '../events/EventBus.js'

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
  /** WebSocket transport connection state */
  wsConnection: WsConnectionState
  /** Currently subscribed WebSocket topics */
  wsTopics: readonly string[]
}

/**
 * Connectivity manager configuration.
 */
export interface ConnectivityManagerConfig {
  eventBus: EventBus
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
 * Connectivity manager.
 * Tracks browser online status and API reachability.
 */
export class ConnectivityManager implements IConnectivity {
  private readonly eventBus: EventBus
  private readonly checkInterval: number
  private readonly healthCheckUrl: string | undefined

  private readonly state$ = new BehaviorSubject<ConnectivityState>({
    network:
      typeof navigator !== 'undefined' ? (navigator.onLine ? 'online' : 'offline') : 'unknown',
    serverReachable: 'unknown',
    wsConnection: 'disconnected',
    wsTopics: [],
  })

  private checkTimer: ReturnType<typeof setInterval> | undefined
  private browserSub: Subscription | undefined

  constructor(config: ConnectivityManagerConfig) {
    this.eventBus = config.eventBus
    this.checkInterval = config.checkInterval ?? 30000
    this.healthCheckUrl = config.healthCheckUrl
  }

  /**
   * Get the current connectivity state.
   */
  getState(): ConnectivityState {
    return this.state$.getValue()
  }

  /**
   * Observable of connectivity state changes.
   */
  get state(): Observable<ConnectivityState> {
    return this.state$.asObservable()
  }

  /**
   * Observable of online status (browser + API reachable).
   */
  get online$(): Observable<boolean> {
    return this.state$.pipe(
      map((state) => state.network === 'online' && state.serverReachable === 'yes'),
      distinctUntilChanged(),
    )
  }

  /**
   * Check if we're effectively online.
   */
  isOnline(): boolean {
    const state = this.state$.getValue()
    return state.network === 'online' && state.serverReachable === 'yes'
  }

  /**
   * Start monitoring connectivity.
   */
  start(): void {
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
  stop(): void {
    if (this.browserSub) {
      this.browserSub.unsubscribe()
      this.browserSub = undefined
    }
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = undefined
    }
  }

  /**
   * Report successful API contact.
   * Called by other components when API calls succeed.
   */
  reportContact(): void {
    const now = Date.now()
    this.updateState({
      serverReachable: 'yes',
      lastContact: now,
    })
  }

  /**
   * Report API failure.
   * Called by other components when API calls fail due to network.
   */
  reportFailure(): void {
    this.updateState({ serverReachable: 'no' })
  }

  /**
   * Report WebSocket connection state transition.
   * Emits the corresponding ws:* debug event when the state changes.
   * On disconnect, clears subscribed topics.
   */
  reportWsConnection(wsConnection: WsConnectionState): void {
    const prev = this.state$.getValue()
    if (prev.wsConnection === wsConnection) return

    if (wsConnection === 'disconnected') {
      const lostTopics = prev.wsTopics
      this.state$.next({ ...prev, wsConnection, wsTopics: [] })
      this.eventBus.emit('ws:disconnected', { topics: lostTopics })
    } else {
      this.state$.next({ ...prev, wsConnection })
      if (wsConnection === 'connecting') {
        this.eventBus.emit('ws:connecting', {})
      } else {
        this.eventBus.emit('ws:connected', {})
      }
    }
  }

  /**
   * Report WebSocket topics confirmed by the server.
   * Merges with existing topics and emits ws:subscribed.
   */
  reportWsSubscribed(topics: readonly string[]): void {
    const prev = this.state$.getValue()
    const merged = Array.from(new Set([...prev.wsTopics, ...topics]))
    this.state$.next({ ...prev, wsTopics: merged })
    this.eventBus.emit('ws:subscribed', { topics })
  }

  /**
   * Check API connectivity via health check endpoint.
   */
  private async checkApiConnectivity(): Promise<void> {
    if (!this.healthCheckUrl) return

    try {
      const response = await fetch(this.healthCheckUrl, {
        method: 'HEAD',
        cache: 'no-store',
      })

      if (response.ok) {
        this.reportContact()
      } else {
        this.reportFailure()
      }
    } catch {
      this.reportFailure()
    }
  }

  /**
   * Update state and emit events.
   */
  private updateState(updates: Partial<ConnectivityState>): void {
    const prev = this.state$.getValue()
    const next = { ...prev, ...updates }

    // Check if effective online status changed
    const wasOnline = prev.network === 'online' && prev.serverReachable === 'yes'
    const isOnline = next.network === 'online' && next.serverReachable === 'yes'

    this.state$.next(next)

    if (wasOnline !== isOnline) {
      logProvider.log.debug({ online: isOnline }, 'Connectivity changed')
      this.eventBus.emit('connectivity:changed', { online: isOnline })
    }
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.stop()
    this.state$.complete()
  }
}
