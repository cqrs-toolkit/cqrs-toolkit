import { Link, logProvider } from '@meticoeus/ddd-es'
import { BehaviorSubject, distinctUntilChanged, map, Observable } from 'rxjs'
import { EventBus } from '../events/index.js'
import {
  ConnectivityState,
  IConnectivityManager,
  WsConnectionState,
} from './IConnectivityManager.js'

/**
 * Connectivity manager configuration.
 */
export interface ConnectivityManagerConfig {
  /** Interval to check API connectivity (ms) */
  checkInterval?: number
  /** API health check URL */
  healthCheckUrl?: string
}

export abstract class AbstractConnectivityManager<
  TLink extends Link,
> implements IConnectivityManager<TLink> {
  protected readonly checkInterval: number
  protected readonly healthCheckUrl: string | undefined

  protected checkTimer: ReturnType<typeof setInterval> | undefined

  /** WebSocket transport state — tracked internally, emitted as debug events. */
  protected wsConnectionState: WsConnectionState = 'disconnected'
  protected wsTopicList: string[] = []

  constructor(
    protected readonly eventBus: EventBus<TLink>,
    protected readonly state$: BehaviorSubject<ConnectivityState>,
    config: ConnectivityManagerConfig,
  ) {
    this.checkInterval = config.checkInterval ?? 30000
    this.healthCheckUrl = config.healthCheckUrl
  }

  /**
   * Get the current connectivity state.
   */
  public getState(): ConnectivityState {
    return this.state$.getValue()
  }

  /**
   * Observable of connectivity state changes.
   */
  public get state(): Observable<ConnectivityState> {
    return this.state$.asObservable()
  }

  /**
   * Observable of online status (browser + API reachable).
   */
  public get online$(): Observable<boolean> {
    return this.state$.pipe(
      map((state) => state.network === 'online' && state.serverReachable === 'yes'),
      distinctUntilChanged(),
    )
  }

  /**
   * Check if we're effectively online.
   */
  public isOnline(): boolean {
    const state = this.state$.getValue()
    return state.network === 'online' && state.serverReachable === 'yes'
  }

  /**
   * Start monitoring connectivity.
   */
  public abstract start(): void

  /**
   * Stop monitoring connectivity.
   */
  public stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = undefined
    }
  }

  /**
   * Clean up resources.
   */
  public destroy(): void {
    this.stop()
    this.state$.complete()
  }

  /**
   * Report successful API contact.
   * Called by other components when API calls succeed.
   */
  public reportContact(): void {
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
  public reportFailure(): void {
    this.updateState({ serverReachable: 'no' })
  }

  /**
   * Report WebSocket connection state transition.
   * Emits the corresponding ws:* debug event when the state changes.
   * On disconnect, clears subscribed topics.
   */
  public reportWsConnection(wsConnection: WsConnectionState): void {
    if (this.wsConnectionState === wsConnection) return
    this.wsConnectionState = wsConnection

    if (wsConnection === 'disconnected') {
      const lostTopics = this.wsTopicList
      this.wsTopicList = []
      this.eventBus.emitDebug('ws:disconnected', { topics: lostTopics })
    } else if (wsConnection === 'connecting') {
      this.eventBus.emitDebug('ws:connecting', {})
    } else {
      this.eventBus.emitDebug('ws:connected', {})
    }
  }

  /**
   * Report WebSocket topics confirmed by the server.
   * Merges with existing topics and emits ws:subscribed.
   */
  public reportWsSubscribed(topics: readonly string[]): void {
    const merged = Array.from(new Set([...this.wsTopicList, ...topics]))
    this.wsTopicList = merged
    this.eventBus.emitDebug('ws:subscribed', { topics })
  }

  /**
   * Check API connectivity via health check endpoint.
   */
  protected async checkApiConnectivity(): Promise<void> {
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
  protected updateState(updates: Partial<ConnectivityState>): void {
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
}
