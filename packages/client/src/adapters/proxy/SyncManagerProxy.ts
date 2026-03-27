/**
 * SyncManager proxy — implements CqrsClientSyncManager on the main thread.
 * Combines RPC calls with ConnectivityProxy for observable state.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
import type { CacheKeyIdentity } from '../../core/cache-manager/CacheKey.js'
import type { IConnectivity } from '../../core/sync-manager/ConnectivityManager.js'
import type { CollectionSyncStatus } from '../../core/sync-manager/SeedStatusIndex.js'
import type { CqrsClientSyncManager } from '../../createCqrsClient.js'
import type { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { EventMessage } from '../../protocol/messages.js'
import { ConnectivityProxy } from './ConnectivityProxy.js'

/**
 * Main-thread proxy for the worker-side SyncManager.
 */
export class SyncManagerProxy<TLink extends Link> implements CqrsClientSyncManager<TLink> {
  private readonly channel: WorkerMessageChannel
  private readonly connectivityProxy: ConnectivityProxy

  constructor(channel: WorkerMessageChannel, broadcastEvents$: Observable<EventMessage>) {
    this.channel = channel
    this.connectivityProxy = new ConnectivityProxy(channel, broadcastEvents$)
  }

  get connectivity(): IConnectivity {
    return this.connectivityProxy
  }

  getCollectionStatus(collection: string): CollectionSyncStatus | undefined {
    // Synchronous — returns undefined until an RPC fetch populates it.
    // For reactive consumers, watch sync:* broadcast events.
    return undefined
  }

  getAllStatus(): CollectionSyncStatus[] {
    // Synchronous — returns empty until an RPC fetch populates it.
    return []
  }

  async getSeedStatus(
    cacheKey: CacheKeyIdentity<TLink>,
  ): Promise<'seeded' | 'seeding' | 'unseeded'> {
    return this.channel.request<'seeded' | 'seeding' | 'unseeded'>('syncManager.getSeedStatus', [
      cacheKey,
    ])
  }

  async syncCollection(collection: string): Promise<void> {
    return this.channel.request<void>('syncManager.syncCollection', [collection])
  }

  async seed(cacheKey: CacheKeyIdentity<TLink>): Promise<void> {
    return this.channel.request<void>('syncManager.seed', [cacheKey])
  }

  async setAuthenticated(params: { userId: string }): Promise<{ resumed: boolean }> {
    return this.channel.request<{ resumed: boolean }>('syncManager.setAuthenticated', [params])
  }

  async setUnauthenticated(): Promise<void> {
    return this.channel.request<void>('syncManager.setUnauthenticated')
  }

  /**
   * Sync connectivity state from the worker.
   */
  async syncState(): Promise<void> {
    await this.connectivityProxy.syncState()
  }

  destroy(): void {
    this.connectivityProxy.destroy()
  }
}
