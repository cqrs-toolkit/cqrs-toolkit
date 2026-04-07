/**
 * Renderer-side command file store for Electron.
 *
 * Transfers files to the utility process where FsCommandFileStore writes
 * them to disk. Two transfer strategies:
 *
 * 1. **Path transfer** — when the file has a `.path` property (Electron
 *    extension on File objects from `<input>` or drag-from-Explorer).
 *    Sends only the path string; the worker copies from the source.
 *
 * 2. **ArrayBuffer transfer** — when no path is available (clipboard
 *    images, programmatic blobs, drag-from-browser). Uses postMessage
 *    transferables for zero-copy ownership transfer.
 */

import type { protocol } from '@cqrs-toolkit/client'
import type { ICommandFileStore } from '@cqrs-toolkit/client/internals'

/**
 * Electron File type — extends standard File with .path from Electron.
 */
interface ElectronFile extends File {
  path?: string
}

export class ElectronCommandFileStore implements ICommandFileStore {
  private readonly channel: protocol.WorkerMessageChannel

  constructor(channel: protocol.WorkerMessageChannel) {
    this.channel = channel
  }

  async save(commandId: string, fileId: string, data: Blob): Promise<string> {
    const file = data as ElectronFile

    if (file.path) {
      // Local file — send path, worker copies from source
      return this.channel.request<string>('fileStore.savePath', [commandId, fileId, file.path])
    }

    // No path — send as ArrayBuffer (serializer handles base64 encoding)
    const arrayBuffer = await data.arrayBuffer()
    return this.channel.request<string>('fileStore.saveBuffer', [
      commandId,
      fileId,
      arrayBuffer,
      data.type,
    ])
  }

  async read(commandId: string, fileId: string): Promise<Blob | undefined> {
    // Reads happen on the worker side; the renderer doesn't need local copies
    return this.channel.request<Blob | undefined>('fileStore.read', [commandId, fileId])
  }

  async deleteForCommand(commandId: string): Promise<void> {
    return this.channel.request<void>('fileStore.deleteForCommand', [commandId])
  }

  async clear(): Promise<void> {
    return this.channel.request<void>('fileStore.clear')
  }

  async cleanOrphans(existingCommandIds: Set<string>): Promise<void> {
    // cleanOrphans is called on startup in the worker, not from the renderer
  }
}
