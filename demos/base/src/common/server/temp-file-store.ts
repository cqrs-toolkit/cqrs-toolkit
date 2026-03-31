/**
 * Temp file store — stores file binaries in OS temp directory.
 * Cleaned up on process shutdown via Fastify's onClose hook.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export class TempFileStore {
  private readonly dir: string

  constructor() {
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cqrs-demo-files-'))
  }

  /** Store a file and return the absolute path on disk. */
  save(id: string, data: Buffer): string {
    const filePath = path.join(this.dir, id)
    fs.writeFileSync(filePath, data)
    return filePath
  }

  /** Read a file by its absolute path on disk. */
  read(filePath: string): Buffer | undefined {
    if (!fs.existsSync(filePath)) return undefined
    return fs.readFileSync(filePath)
  }

  /** Delete a file by its absolute path on disk. */
  delete(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }

  clear(): void {
    if (fs.existsSync(this.dir)) {
      for (const file of fs.readdirSync(this.dir)) {
        fs.unlinkSync(path.join(this.dir, file))
      }
    }
  }

  cleanup(): void {
    if (fs.existsSync(this.dir)) {
      fs.rmSync(this.dir, { recursive: true, force: true })
    }
  }
}
