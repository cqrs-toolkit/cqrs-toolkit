/**
 * Generated types — do not edit.
 * Regenerate with: cqrs-toolkit client pull
 */

import type { EntityId } from '@cqrs-toolkit/client'

export interface FileObjectCollectionReadModelV1_0_0 {
  _embedded: {
    item: FileObjectReadModelV1_0_0[]
  }
  _links: HalCollectionLinksV1_0_0
  totalItems?: number
}

export interface FileObjectReadModelV1_0_0 {
  _links: HalResourceLinksV1_0_0
  contentType: string
  createdAt: string
  id: EntityId
  latestRevision: string
  name: string
  noteId: EntityId
  notebookId: EntityId
  resource: string
  size: number
}

export interface HalCollectionLinksV1_0_0 {
  first?: {
    href: string
  }
  next?: {
    href: string
  }
  prev?: {
    href: string
  }
  search?: {
    href: string
    templated?: boolean
  }
  self: {
    href: string
  }
}

export interface HalResourceLinksV1_0_0 {
  collection?: {
    href: string
  }
  self: {
    href: string
  }
}

export interface NoteCollectionReadModelV1_0_0 {
  _embedded: {
    item: NoteReadModelV1_0_0[]
  }
  _links: HalCollectionLinksV1_0_0
  totalItems?: number
}

export interface NoteReadModelV1_0_0 {
  _links: HalResourceLinksV1_0_0
  body: string
  createdAt: string
  id: EntityId
  latestRevision: string
  notebookId: EntityId
  title: string
  updatedAt: string
}

export interface NotebookCollectionReadModelV1_0_0 {
  _embedded: {
    item: NotebookReadModelV1_0_0[]
  }
  _links: HalCollectionLinksV1_0_0
  totalItems?: number
}

export interface NotebookReadModelV1_0_0 {
  _links: HalResourceLinksV1_0_0
  createdAt: string
  id: EntityId
  latestRevision: string
  name: string
  tags: string[]
  updatedAt: string
}

export interface StoragePresignedPermitResponseV1_0_0 {
  data: {
    uploadForm: {
      fields: {
        [k: string]: string | undefined
      }
      url: string
    }
  }
  id: string
}

export interface TodoCollectionReadModelV1_0_0 {
  _embedded: {
    item: TodoReadModelV1_0_0[]
  }
  _links: HalCollectionLinksV1_0_0
  totalItems?: number
}

export interface TodoReadModelV1_0_0 {
  _links: HalResourceLinksV1_0_0
  content: string
  createdAt: string
  id: EntityId
  latestRevision: string
  status: 'pending' | 'in_progress' | 'completed'
  updatedAt: string
}
