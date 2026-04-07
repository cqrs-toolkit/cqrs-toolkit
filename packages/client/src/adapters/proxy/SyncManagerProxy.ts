/**
 * SyncManager proxy — implements CqrsClientSyncManager on the main thread.
 * Combines RPC calls with ConnectivityProxy for observable state.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
import type { CacheKeyIdentity } from '../../core/cache-manager/CacheKey.js'
import type { IConnectivity } from '../../core/sync-manager/IConnectivityManager.js'
import type { CollectionSyncStatus } from '../../core/sync-manager/SeedStatusIndex.js'
import type { CqrsClientSyncManager } from '../../createCqrsClient.js'
import type { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { EventMessage } from '../../protocol/messages.js'
import { ConnectivityProxy } from './ConnectivityProxy.js'

/**
 * Main-thread proxy for the worker-side SyncManager.
 */
export class SyncManagerProxy<TLink extends Link> implements CqrsClientSyncManager<TLink> {
  private readonly connectivityProxy: ConnectivityProxy

  constructor(
    private readonly channel: WorkerMessageChannel,
    broadcastEvents$: Observable<EventMessage>,
  ) {
    this.connectivityProxy = new ConnectivityProxy(channel, broadcastEvents$)
  }

  get connectivity(): IConnectivity {
    return this.connectivityProxy
  }

  async getCollectionStatus(
    collection: string,
    cacheKey: CacheKeyIdentity<TLink>,
  ): Promise<CollectionSyncStatus | undefined> {
    return this.channel.request<CollectionSyncStatus | undefined>(
      'syncManager.getCollectionStatus',
      [collection, cacheKey],
    )
  }

  async getAllStatus(): Promise<CollectionSyncStatus[]> {
    return this.channel.request<CollectionSyncStatus[]>('syncManager.getAllStatus')
  }

  async getSeedStatus(
    cacheKey: CacheKeyIdentity<TLink>,
  ): Promise<'seeded' | 'seeding' | 'unseeded'> {
    return this.channel.request<'seeded' | 'seeding' | 'unseeded'>('syncManager.getSeedStatus', [
      cacheKey,
    ])
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
