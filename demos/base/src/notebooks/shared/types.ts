/**
 * Notebook entity and query response types.
 */

import type { ValidationError } from '@cqrs-toolkit/client'
import { Exception } from '@meticoeus/ddd-es'

/**
 * Domain exception: a notebook with this name already exists.
 * Thrown by the server and pre-checked by the client via async validation.
 */
export class DuplicateNotebookNameException extends Exception<ValidationError[]> {
  constructor(name: string) {
    super('DuplicateNotebookNameException', `A notebook with name "${name}" already exists`, 400)
    this._details = [
      {
        path: 'name',
        code: 'duplicate',
        message: 'A notebook with this name already exists',
        params: { name },
      },
    ]
  }
}

export interface NotebookBase {
  readonly name: string
  readonly tags: string[]
  readonly createdAt: string
  readonly updatedAt: string
  readonly latestRevision?: string | undefined
}
