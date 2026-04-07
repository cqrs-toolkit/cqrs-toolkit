/**
 * Internal interface for command file storage.
 *
 * Files attached to commands are stored separately from the command record:
 * - Mode B/C: OPFS at /cqrs-client/uploads/{commandId}/{fileId}
 * - Mode A: in-memory Map<string, Blob>
 *
 * This interface is internal to the library — consumers interact with
 * `files?: File[]` on EnqueueCommand and `fileRefs?: FileRef[]` on CommandRecord.
 */

export interface ICommandFileStore {
  /** Store a file blob for a command. Returns the storage path from root. */
  save(commandId: string, fileId: string, data: Blob): Promise<string>

  /** Read a file blob. Returns undefined if not found. */
  read(commandId: string, fileId: string): Promise<Blob | undefined>

  /** Delete all files for a command. */
  deleteForCommand(commandId: string): Promise<void>

  /** Delete all stored files. */
  clear(): Promise<void>

  /**
   * Remove orphaned files — files whose commandId has no matching command record.
   * Called on startup (Mode B/C) after SQLite is initialized.
   */
  cleanOrphans(existingCommandIds: Set<string>): Promise<void>
}
