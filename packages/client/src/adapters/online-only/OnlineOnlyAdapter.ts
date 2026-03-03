/**
 * Online-only adapter (Mode A).
 * All state is stored in memory and lost on page reload.
 * No worker orchestration or cross-tab coordination.
 */

import type { IStorage } from '../../storage/IStorage.js'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import type { ExecutionMode, ResolvedConfig } from '../../types/config.js'
import { BaseAdapter } from '../base/BaseAdapter.js'

/**
 * Online-only adapter for development, testing, and deployments
 * where offline persistence is not required.
 */
export class OnlineOnlyAdapter extends BaseAdapter {
  readonly mode: ExecutionMode = 'online-only'

  constructor(config: ResolvedConfig) {
    super(config)
  }

  protected async createStorage(): Promise<IStorage> {
    return new InMemoryStorage()
  }
}
