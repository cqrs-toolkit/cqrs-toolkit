/**
 * Connectivity proxy — reconstructs ConnectivityManager-like interface on the main thread
 * from broadcast events and on-demand RPC queries.
 */

import { BehaviorSubject, Observable, distinctUntilChanged, map } from 'rxjs'
import type {
  ConnectivityState,
  IConnectivity,
} from '../../core/sync-manager/ConnectivityManager.js'
import type { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { EventMessage } from '../../protocol/messages.js'

/**
 * Main-thread proxy that mirrors ConnectivityManager's observable interface.
 * Tracks connectivity state from broadcast events.
 */
export class ConnectivityProxy implements IConnectivity {
  private readonly channel: WorkerMessageChannel
  private readonly state$: BehaviorSubject<ConnectivityState>

  constructor(channel: WorkerMessageChannel, events$: Observable<EventMessage>) {
    this.channel = channel
    this.state$ = new BehaviorSubject<ConnectivityState>({
      network: 'unknown',
      serverReachable: 'unknown',
      wsConnection: 'disconnected',
      wsTopics: [],
    })

    // Track broadcast events to update local state
    events$.subscribe((event) => {
      const current = this.state$.getValue()
      switch (event.eventName) {
        case 'connectivity:changed': {
          const payload = event.payload as { online: boolean }
          this.state$.next({
            ...current,
            network: payload.online ? 'online' : 'offline',
            serverReachable: payload.online ? 'yes' : 'no',
            lastContact: payload.online ? Date.now() : current.lastContact,
          })
          break
        }
        case 'ws:connecting':
          this.state$.next({ ...current, wsConnection: 'connecting' })
          break
        case 'ws:connected':
          this.state$.next({ ...current, wsConnection: 'connected' })
          break
        case 'ws:subscribed': {
          const payload = event.payload as { topics: readonly string[] }
          const merged = Array.from(new Set([...current.wsTopics, ...payload.topics]))
          this.state$.next({ ...current, wsTopics: merged })
          break
        }
        case 'ws:disconnected':
          this.state$.next({ ...current, wsConnection: 'disconnected', wsTopics: [] })
          break
      }
    })
  }

  getState(): ConnectivityState {
    return this.state$.getValue()
  }

  isOnline(): boolean {
    const state = this.state$.getValue()
    return state.network === 'online' && state.serverReachable === 'yes'
  }

  get state(): Observable<ConnectivityState> {
    return this.state$.asObservable()
  }

  get online$(): Observable<boolean> {
    return this.state$.pipe(
      map((s) => s.network === 'online' && s.serverReachable === 'yes'),
      distinctUntilChanged(),
    )
  }

  /**
   * Fetch the authoritative state from the worker.
   * Call this once after initialization to sync up.
   */
  async syncState(): Promise<void> {
    const state = await this.channel.request<ConnectivityState>('connectivity.getState')
    this.state$.next(state)
  }

  destroy(): void {
    this.state$.complete()
  }
}
