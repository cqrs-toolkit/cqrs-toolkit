/**
 * Auto-detection of the best execution mode for the current environment.
 *
 * Detection order (spec §0.1):
 * 1. OPFS API available + SharedWorker available → 'shared-worker' (multi-tab support)
 * 2. OPFS API available + Worker available → 'dedicated-worker' (single-tab with dedicated worker)
 * 3. Otherwise → 'online-only' (in-memory, no persistence)
 *
 * The OPFS check here is a sync feature-detect (`navigator.storage.getDirectory` exists).
 * The authoritative check is the in-worker `createSyncAccessHandle()` probe in
 * WorkerOrchestrator — this sync check just avoids spawning a worker that will
 * immediately fail when the browser clearly lacks OPFS.
 */

import type { ExecutionMode } from '../types/config.js'

/**
 * Sync feature-detect for OPFS availability.
 *
 * Checks that `navigator.storage.getDirectory` exists — a necessary (but not
 * sufficient) condition for OPFS-backed SQLite. The authoritative check runs
 * inside the worker via `probeOpfs()`.
 */
function isOpfsLikelyAvailable(): boolean {
  return (
    typeof globalThis.navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function'
  )
}

/**
 * Detect the best execution mode for the current browser environment.
 *
 * @returns The most capable execution mode available
 */
export function detectMode(): ExecutionMode {
  if (!isOpfsLikelyAvailable()) {
    return 'online-only'
  }

  if (typeof SharedWorker !== 'undefined') {
    return 'shared-worker'
  }

  if (typeof Worker !== 'undefined') {
    return 'dedicated-worker'
  }

  return 'online-only'
}
