/**
 * Auto-detection of the best execution mode for the current environment.
 *
 * Detection order (spec §0.1):
 * 1. SharedWorker available → 'shared-worker' (multi-tab support)
 * 2. Worker available → 'dedicated-worker' (single-tab with dedicated worker)
 * 3. Otherwise → 'main-thread' (single-tab on main thread)
 */

import type { ExecutionMode } from '../types/config.js'

/**
 * Detect the best execution mode for the current browser environment.
 *
 * @returns The most capable execution mode available
 */
export function detectMode(): ExecutionMode {
  if (typeof SharedWorker !== 'undefined') {
    return 'shared-worker'
  }

  if (typeof Worker !== 'undefined') {
    return 'dedicated-worker'
  }

  return 'main-thread'
}
