/**
 * Adapter exports.
 */

export type {
  AdapterStatus,
  CqrsClientSyncManager,
  IAdapter,
  IOnlineOnlyAdapter,
  IWorkerAdapter,
} from './base/IAdapter.js'
export { OnlineOnlyAdapter } from './online-only/OnlineOnlyAdapter.js'

// Mode B: SharedWorker
export { SharedWorkerAdapter } from './shared-worker/index.js'
export type { SharedWorkerAdapterConfig } from './shared-worker/index.js'

// Mode C: Dedicated Worker
export { DedicatedWorkerAdapter, TabLockError } from './dedicated-worker/index.js'
export type { DedicatedWorkerAdapterConfig } from './dedicated-worker/index.js'
