/**
 * OPFS-backed command file store — Mode B/C (worker modes).
 *
 * Files are stored at: /cqrs-client/uploads/{commandId}/{fileId}
 *
 * Window writes files using the async OPFS API before enqueuing.
 * Worker reads files from OPFS when executing upload commands.
 * File data never crosses postMessage — OPFS is the shared medium.
 */

import type { ICommandFileStore } from './ICommandFileStore.js'

const ROOT_DIR = 'cqrs-client'
const UPLOADS_DIR = 'uploads'

export class OpfsCommandFileStore implements ICommandFileStore {
  async save(commandId: string, fileId: string, data: Blob): Promise<void> {
    const commandDir = await getCommandDir(commandId, true)
    const fileHandle = await commandDir.getFileHandle(fileId, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(data)
    await writable.close()
  }

  async read(commandId: string, fileId: string): Promise<Blob | undefined> {
    try {
      const commandDir = await getCommandDir(commandId, false)
      const fileHandle = await commandDir.getFileHandle(fileId)
      return fileHandle.getFile()
    } catch {
      return undefined
    }
  }

  async deleteForCommand(commandId: string): Promise<void> {
    try {
      const uploadsDir = await getUploadsDir(false)
      await uploadsDir.removeEntry(commandId, { recursive: true })
    } catch {
      // Directory doesn't exist — nothing to delete
    }
  }

  async clear(): Promise<void> {
    try {
      const rootDir = await getRootDir(false)
      await rootDir.removeEntry(UPLOADS_DIR, { recursive: true })
    } catch {
      // Directory doesn't exist — nothing to clear
    }
  }

  async cleanOrphans(existingCommandIds: Set<string>): Promise<void> {
    let uploadsDir: FileSystemDirectoryHandle
    try {
      uploadsDir = await getUploadsDir(false)
    } catch {
      return // No uploads directory — no orphans
    }

    const orphanedDirs: string[] = []
    for await (const [name, handle] of uploadsDir.entries()) {
      if (handle.kind === 'directory' && !existingCommandIds.has(name)) {
        orphanedDirs.push(name)
      }
    }

    for (const name of orphanedDirs) {
      await uploadsDir.removeEntry(name, { recursive: true })
    }
  }
}

// ---------------------------------------------------------------------------
// OPFS path helpers
// ---------------------------------------------------------------------------

async function getRootDir(create: boolean): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(ROOT_DIR, { create })
}

async function getUploadsDir(create: boolean): Promise<FileSystemDirectoryHandle> {
  const rootDir = await getRootDir(create)
  return rootDir.getDirectoryHandle(UPLOADS_DIR, { create })
}

async function getCommandDir(
  commandId: string,
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  const uploadsDir = await getUploadsDir(create)
  return uploadsDir.getDirectoryHandle(commandId, { create })
}
