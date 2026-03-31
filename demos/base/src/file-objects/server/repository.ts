/**
 * FileObject repository — extends Repository with a read model cache for queries.
 *
 * Resolves notebookId from the associated note for topic tagging and read model construction.
 */

import type { FileObject } from '@cqrs-toolkit/demo-base/file-objects/shared'
import type { NoteRepository } from '@cqrs-toolkit/demo-base/notes/server'
import {
  Repository,
  type ConcurrencyException,
  type EventConflictException,
  type EventRevision,
  type IEventStore,
  type Result,
  type SaveEventSuccess,
} from '@meticoeus/ddd-es'
import assert from 'node:assert'
import { FileObjectAggregate, type FileObjectServerEvent } from './aggregate.js'

export class FileObjectRepository extends Repository<FileObjectServerEvent, FileObjectAggregate> {
  private readonly readModels = new Map<string, FileObject>()
  private readonly noteRepo: NoteRepository

  protected override async persistEvents(
    aggregate: FileObjectAggregate,
    events: FileObjectServerEvent[],
    expectedRevision: EventRevision,
  ) {
    const note = this.noteRepo.findById(aggregate.noteId)
    assert(note, `Note ${aggregate.noteId} not found — cannot tag FileObject events with topic`)
    const topic = `Notebook:${note.notebookId}`
    const tagged = events.map((e) => ({ ...e, metadata: { ...e.metadata, topic } }))
    return super.persistEvents(aggregate, tagged, expectedRevision)
  }

  constructor(storage: IEventStore, noteRepo: NoteRepository) {
    super(FileObjectAggregate, storage)
    this.noteRepo = noteRepo
  }

  override async save(
    aggregate: FileObjectAggregate,
    expectedRevision: EventRevision,
  ): Promise<
    Result<SaveEventSuccess<FileObjectServerEvent>, ConcurrencyException | EventConflictException>
  > {
    const result = await super.save(aggregate, expectedRevision)

    if (result.ok) {
      if (aggregate.deleted) {
        this.readModels.delete(aggregate.id)
      } else {
        const note = this.noteRepo.findById(aggregate.noteId)
        assert(note, `Note ${aggregate.noteId} not found — cannot build FileObject read model`)
        this.readModels.set(aggregate.id, aggregate.toReadModel(note.notebookId))
      }
    }

    return result
  }

  clear(): void {
    this.readModels.clear()
  }

  findById(id: string): FileObject | undefined {
    return this.readModels.get(id)
  }

  findByNoteId(noteId: string): FileObject[] {
    return Array.from(this.readModels.values()).filter((f) => f.noteId === noteId)
  }

  listByNote(
    noteId: string,
    cursor?: string,
    limit = 50,
  ): { items: FileObject[]; nextCursor: string | null } {
    const filtered = this.findByNoteId(noteId)
    const sorted = filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    let startIndex = 0
    if (cursor) {
      startIndex = sorted.findIndex((f) => f.id === cursor)
      if (startIndex === -1) startIndex = 0
      else startIndex += 1
    }

    const items = sorted.slice(startIndex, startIndex + limit)
    const hasMore = startIndex + limit < sorted.length
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null

    return { items, nextCursor }
  }

  list(cursor?: string, limit = 50): { items: FileObject[]; nextCursor: string | null } {
    const sorted = Array.from(this.readModels.values()).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )

    let startIndex = 0
    if (cursor) {
      startIndex = sorted.findIndex((f) => f.id === cursor)
      if (startIndex === -1) startIndex = 0
      else startIndex += 1
    }

    const items = sorted.slice(startIndex, startIndex + limit)
    const hasMore = startIndex + limit < sorted.length
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null

    return { items, nextCursor }
  }
}
