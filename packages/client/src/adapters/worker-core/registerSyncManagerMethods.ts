/**
 * Registers SyncManager, ConnectivityManager, and SessionManager RPC methods
 * on the worker message handler.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { CacheKeyIdentity } from '../../core/cache-manager/CacheKey.js'
import type { IAnticipatedEvent } from '../../core/command-lifecycle/AnticipatedEventShape.js'
import type { SessionManager } from '../../core/session/SessionManager.js'
import type { SyncManager } from '../../core/sync-manager/SyncManager.js'
import type { WorkerMessageHandler } from '../../protocol/MessageChannel.js'

export function registerSyncManagerMethods<
  TLink extends Link,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(
  handler: WorkerMessageHandler,
  syncManager: SyncManager<TLink, TSchema, TEvent>,
  sessionManager: SessionManager<TLink>,
): void {
  // SyncManager methods (CqrsClientSyncManager interface)
  handler.registerMethod('syncManager.getCollectionStatus', async (args) => {
    return syncManager.getCollectionStatus(args[0] as string)
  })

  handler.registerMethod('syncManager.getAllStatus', async () => {
    return syncManager.getAllStatus()
  })

  handler.registerMethod('syncManager.getSeedStatus', async (args) => {
    return syncManager.getSeedStatus(args[0] as CacheKeyIdentity<TLink>)
  })

  handler.registerMethod('syncManager.syncCollection', async (args) => {
    return syncManager.syncCollection(args[0] as string)
  })

  handler.registerMethod('syncManager.seed', async (args) => {
    return syncManager.seed(args[0] as CacheKeyIdentity<TLink>)
  })

  handler.registerMethod('syncManager.setAuthenticated', async (args) => {
    return syncManager.setAuthenticated(args[0] as { userId: string })
  })

  handler.registerMethod('syncManager.setUnauthenticated', async () => {
    return syncManager.setUnauthenticated()
  })

  // ConnectivityManager methods
  handler.registerMethod('connectivity.getState', async () => {
    return syncManager.getConnectivity().getState()
  })

  handler.registerMethod('connectivity.isOnline', async () => {
    return syncManager.getConnectivity().isOnline()
  })

  // SessionManager methods (read-only access from main thread)
  handler.registerMethod('session.getAuthState', async () => {
    return sessionManager.getAuthState()
  })

  handler.registerMethod('session.getSessionState', async () => {
    return sessionManager.getSessionState()
  })

  handler.registerMethod('session.isNetworkPaused', async () => {
    return sessionManager.isNetworkPaused()
  })

  handler.registerMethod('session.getUserId', async () => {
    return sessionManager.getUserId()
  })

  handler.registerMethod('session.touchSession', async () => {
    return sessionManager.touchSession()
  })
}
