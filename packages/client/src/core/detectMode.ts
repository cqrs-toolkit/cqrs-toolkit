/**
 * Auto-detection of the best execution mode for the current environment.
 *
 * Detection order (spec §0.1.2):
 * 1. OPFS API available + Web Locks available
 * 2. SharedWorker available → 'shared-worker' (Mode C, multi-tab)
 * 3. Worker available → 'dedicated-worker' (Mode B, single-tab)
 * 4. Otherwise → 'online-only' (Mode A, in-memory)
 *
 * The checks here are Stage 1 sync feature-detection. The authoritative Stage 2
 * check is the in-worker `createSyncAccessHandle()` probe — Stage 1 just avoids
 * spawning a worker that will immediately fail.
 *
 * Mode cache (§0.1.7): After a successful Stage 2 probe, the resolved mode is
 * cached in localStorage so subsequent page loads skip Stage 1 detection.
 * The cache is invalidated by browser updates (userAgent change) or schema
 * version bumps. Mode A is never cached.
 */

import type { ExecutionMode } from '../types/config.js'

/**
 * Detect the best execution mode for the current browser environment.
 *
 * Stage 1 checks:
 * - `navigator.storage.getDirectory` exists (OPFS entry point)
 * - `navigator.locks` exists (Web Locks API, required for tab coordination)
 *
 * Note: `createSyncAccessHandle` is NOT checked here — some browsers don't
 * expose it on the main-thread prototype even though it works inside workers.
 * The authoritative check runs inside the worker via the Stage 2 OPFS probe.
 *
 * @returns The most capable execution mode available
 */
export function detectMode(): ExecutionMode {
  if (
    typeof globalThis.navigator === 'undefined' ||
    typeof navigator.storage?.getDirectory !== 'function' ||
    !('locks' in navigator)
  ) {
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

// ---------------------------------------------------------------------------
// Mode cache (§0.1.7)
// ---------------------------------------------------------------------------

const MODE_CACHE_KEY = 'cqrs:mode-cache:v1'

interface ModeCache {
  mode: 'C' | 'B'
  userAgent: string
  version: number
}

/**
 * Read a previously cached execution mode from localStorage.
 *
 * Returns `undefined` on cache miss, schema mismatch, or userAgent change.
 * Mode A is never cached.
 */
export function readModeCache(): ExecutionMode | undefined {
  try {
    const raw = localStorage.getItem(MODE_CACHE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as ModeCache
    if (parsed.version !== 1) return undefined
    if (parsed.userAgent !== navigator.userAgent) return undefined
    return parsed.mode === 'C' ? 'shared-worker' : 'dedicated-worker'
  } catch {
    return undefined
  }
}

/**
 * Write the resolved execution mode to localStorage after successful Stage 2.
 *
 * Mode A (online-only) is never cached — it's the fallback, not a detected capability.
 */
export function writeModeCache(mode: ExecutionMode): void {
  if (mode === 'online-only') return
  try {
    const entry: ModeCache = {
      mode: mode === 'shared-worker' ? 'C' : 'B',
      userAgent: navigator.userAgent,
      version: 1,
    }
    localStorage.setItem(MODE_CACHE_KEY, JSON.stringify(entry))
  } catch {
    // localStorage unavailable — re-detect next startup
  }
}
