/**
 * OPFS availability probe for worker environments.
 *
 * Tests whether `createSyncAccessHandle()` works inside the current worker.
 * This is the authoritative check — the main thread can only do a sync
 * feature-detect on `navigator.storage.getDirectory` existence, but that
 * does not guarantee the full API chain works (quota, permissions, etc.).
 */

import { Err, Exception, Ok, type Result } from '@meticoeus/ddd-es'

/**
 * OPFS is not available in this worker environment.
 *
 * Thrown at the RPC boundary (worker → main thread) so the adapter layer
 * can catch it and the client factory can fall back to online-only mode.
 */
export class OpfsUnavailableException extends Exception {
  readonly errorCode = 'OPFS_UNAVAILABLE'

  constructor() {
    super('OpfsUnavailable', 'OPFS is not available: createSyncAccessHandle() probe failed')
  }
}

/**
 * Probe OPFS sync file access inside a worker.
 *
 * Creates a temporary file, opens a SyncAccessHandle, then cleans up.
 * Returns `Err` if any step fails — the caller decides whether to
 * fall back or propagate.
 */
export async function probeOpfs(): Promise<Result<void, OpfsUnavailableException>> {
  try {
    const root = await navigator.storage.getDirectory()
    const testFile = await root.getFileHandle('__cqrs_opfs_probe__', { create: true })
    const handle = await testFile.createSyncAccessHandle()
    handle.close()
    await root.removeEntry('__cqrs_opfs_probe__')
    return Ok()
  } catch {
    return Err(new OpfsUnavailableException())
  }
}
