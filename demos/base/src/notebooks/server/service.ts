/**
 * Notebook domain service — operations spanning Notebook and Note aggregates.
 */

import type {
  ConcurrencyException,
  EventConflictException,
  EventMetadata,
  Result,
  SaveEventSuccess,
} from '@meticoeus/ddd-es'
import type { NoteRepository } from '../../notes/server/repository.js'
import type { NotebookServerEvent } from './aggregate.js'
import type { NotebookRepository } from './repository.js'

export class NotebookService {
  constructor(
    private readonly notebookRepo: NotebookRepository,
    private readonly noteRepo: NoteRepository,
  ) {}

  /**
   * Delete a notebook and cascade-delete all child notes.
   *
   * Returns only the notebook aggregate result. Child NoteDeleted events
   * flow to clients via WS (Notebook:* subscription) and sync — the
   * response must not include them because the set is unbounded.
   */
  async deleteNotebook(
    id: string,
    expectedRevision: bigint,
    metadata: EventMetadata,
  ): Promise<
    Result<SaveEventSuccess<NotebookServerEvent>, ConcurrencyException | EventConflictException>
  > {
    const aggregate = await this.notebookRepo.getById(id)
    if (!aggregate) {
      throw new Error(`Notebook not found: ${id}`)
    }

    aggregate.markDeleted(metadata)
    const result = await this.notebookRepo.save(aggregate, expectedRevision)

    if (result.ok) {
      const childNotes = this.noteRepo.findByNotebookId(id)
      for (const note of childNotes) {
        const noteAggregate = await this.noteRepo.getById(note.id)
        if (noteAggregate && !noteAggregate.deleted) {
          noteAggregate.markDeleted(metadata)
          await this.noteRepo.save(noteAggregate, noteAggregate.revision)
        }
      }
    }

    return result
  }
}
