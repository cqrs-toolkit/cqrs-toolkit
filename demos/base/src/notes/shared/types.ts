/**
 * Note base type.
 */

export interface NoteBase {
  readonly title: string
  readonly body: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly latestRevision?: string | undefined
}
