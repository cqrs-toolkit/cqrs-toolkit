/**
 * Adapter exports.
 */

export type { AdapterStatus, IAdapter } from './base/IAdapter.js'
export { OnlineOnlyAdapter } from './online-only/OnlineOnlyAdapter.js'

// Mode B: SharedWorker
export { SharedWorkerAdapter, SharedWorkerStorageProxy } from './shared-worker/index.js'
export type { SharedWorkerAdapterConfig } from './shared-worker/index.js'

// Mode C: Dedicated Worker
export {
  DedicatedWorkerAdapter,
  DedicatedWorkerStorageProxy,
  TabLockError,
} from './dedicated-worker/index.js'
export type { DedicatedWorkerAdapterConfig } from './dedicated-worker/index.js'

// Mode D: Main Thread
export { MainThreadAdapter, TabLockError as MainThreadTabLockError } from './main-thread/index.js'
