/**
 * In-memory command file store — Mode A (online-only).
 *
 * Stores Blob references in a Map. Lost on page reload, which is acceptable
 * since Mode A makes no persistence guarantees (spec §3.14.4).
 */

import type { ICommandFileStore } from './ICommandFileStore.js'

export class InMemoryCommandFileStore implements ICommandFileStore {
  private readonly files = new Map<string, Blob>()

  async save(commandId: string, fileId: string, data: Blob): Promise<string> {
    const key = toKey(commandId, fileId)
    this.files.set(key, data)
    return key
  }

  async read(commandId: string, fileId: string): Promise<Blob | undefined> {
    return this.files.get(toKey(commandId, fileId))
  }

  async deleteForCommand(commandId: string): Promise<void> {
    const prefix = `${commandId}/`
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        this.files.delete(key)
      }
    }
  }

  async clear(): Promise<void> {
    this.files.clear()
  }

  async cleanOrphans(existingCommandIds: Set<string>): Promise<void> {
    for (const key of this.files.keys()) {
      const commandId = key.split('/')[0]
      if (commandId && !existingCommandIds.has(commandId)) {
        this.files.delete(key)
      }
    }
  }
}

function toKey(commandId: string, fileId: string): string {
  return `${commandId}/${fileId}`
}
