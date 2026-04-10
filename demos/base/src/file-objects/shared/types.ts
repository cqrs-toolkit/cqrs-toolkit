/**
 * FileObject base type.
 */

export interface FileObjectBase {
  readonly name: string
  readonly contentType: string
  readonly resource: string
  readonly size: number
  readonly createdAt: string
  readonly latestRevision?: string | undefined
}
