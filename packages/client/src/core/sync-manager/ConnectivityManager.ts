/**
 * Connectivity manager tracks network status.
 */

import { logProvider } from '@meticoeus/ddd-es'
import {
  BehaviorSubject,
  Observable,
  distinctUntilChanged,
  fromEvent,
  map,
  merge,
  startWith,
} from 'rxjs'
import type { EventBus } from '../events/EventBus.js'

/**
 * Connectivity state.
 */
export interface ConnectivityState {
  /** Whether the browser reports being online */
  online: boolean
  /** Whether we've confirmed API connectivity */
  apiReachable: boolean
  /** Last successful API contact timestamp */
  lastContact: number | null
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
 * Connectivity manager.
 * Tracks browser online status and API reachability.
 */
export class ConnectivityManager {
  private readonly eventBus: EventBus
  private readonly checkInterval: number
  private readonly healthCheckUrl: string | null

  private readonly state$ = new BehaviorSubject<ConnectivityState>({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    apiReachable: false,
    lastContact: null,
  })

  private checkTimer: ReturnType<typeof setInterval> | null = null

  constructor(config: ConnectivityManagerConfig) {
    this.eventBus = config.eventBus
    this.checkInterval = config.checkInterval ?? 30000
    this.healthCheckUrl = config.healthCheckUrl ?? null
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
      map((state) => state.online && state.apiReachable),
      distinctUntilChanged(),
    )
  }

  /**
   * Check if we're effectively online.
   */
  isOnline(): boolean {
    const state = this.state$.getValue()
    return state.online && state.apiReachable
  }

  /**
   * Start monitoring connectivity.
   */
  start(): void {
    if (typeof window === 'undefined') return

    // Listen for browser online/offline events
    const online$ = fromEvent(window, 'online').pipe(map(() => true))
    const offline$ = fromEvent(window, 'offline').pipe(map(() => false))

    merge(online$, offline$)
      .pipe(startWith(navigator.onLine))
      .subscribe((online) => {
        this.updateState({ online })

        if (online) {
          // Try to verify API connectivity
          this.checkApiConnectivity()
        }
      })

    // Periodic API connectivity check
    if (this.healthCheckUrl) {
      this.checkTimer = setInterval(() => {
        if (this.state$.getValue().online) {
          this.checkApiConnectivity()
        }
      }, this.checkInterval)

      // Initial check
      this.checkApiConnectivity()
    } else {
      // No health check URL - assume API is reachable when browser is online
      this.updateState({ apiReachable: navigator.onLine })
    }
  }

  /**
   * Stop monitoring connectivity.
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
  }

  /**
   * Report successful API contact.
   * Called by other components when API calls succeed.
   */
  reportContact(): void {
    const now = Date.now()
    this.updateState({
      apiReachable: true,
      lastContact: now,
    })
  }

  /**
   * Report API failure.
   * Called by other components when API calls fail due to network.
   */
  reportFailure(): void {
    this.updateState({ apiReachable: false })
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
    const wasOnline = prev.online && prev.apiReachable
    const isOnline = next.online && next.apiReachable

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
