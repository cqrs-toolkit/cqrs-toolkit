/**
 * Filesystem-backed command file store for Electron.
 *
 * The Electron equivalent of OpfsCommandFileStore. Persists command file
 * uploads to the local filesystem so they survive app restarts and
 * offline sessions.
 *
 * Directory structure mirrors OPFS conventions:
 *   {basePath}/uploads/{commandId}/{fileId}
 */

import type { ICommandFileStore } from '@cqrs-toolkit/client/internals'
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const UPLOADS_DIR = 'uploads'

export class FsCommandFileStore implements ICommandFileStore {
  private readonly uploadsPath: string

  constructor(basePath: string) {
    this.uploadsPath = join(basePath, UPLOADS_DIR)
  }

  async save(commandId: string, fileId: string, data: Blob): Promise<string> {
    const commandDir = join(this.uploadsPath, commandId)
    await mkdir(commandDir, { recursive: true })
    const filePath = join(commandDir, fileId)
    const buffer = Buffer.from(await data.arrayBuffer())
    await writeFile(filePath, buffer)
    return filePath
  }

  async saveFromPath(commandId: string, fileId: string, sourcePath: string): Promise<string> {
    const commandDir = join(this.uploadsPath, commandId)
    await mkdir(commandDir, { recursive: true })
    const destPath = join(commandDir, fileId)
    await copyFile(sourcePath, destPath)
    return destPath
  }

  async read(commandId: string, fileId: string): Promise<Blob | undefined> {
    try {
      const buffer = await readFile(join(this.uploadsPath, commandId, fileId))
      return new Blob([buffer])
    } catch {
      return undefined
    }
  }

  async deleteForCommand(commandId: string): Promise<void> {
    try {
      await rm(join(this.uploadsPath, commandId), { recursive: true })
    } catch {
      // Directory doesn't exist — nothing to delete
    }
  }

  async clear(): Promise<void> {
    try {
      await rm(this.uploadsPath, { recursive: true })
    } catch {
      // Directory doesn't exist — nothing to clear
    }
  }

  async cleanOrphans(existingCommandIds: Set<string>): Promise<void> {
    let entries: string[]
    try {
      entries = await readdir(this.uploadsPath)
    } catch {
      return // No uploads directory — no orphans
    }

    for (const name of entries) {
      if (!existingCommandIds.has(name)) {
        await rm(join(this.uploadsPath, name), { recursive: true, force: true })
      }
    }
  }
}
