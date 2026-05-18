import {
  ConflictException,
  isConflict,
  isRedundant,
  ValidationException,
  type AsyncValidationContext,
  type CacheKeyIdentity,
  type IQueryManager,
} from '@cqrs-toolkit/client'
import type { NotebookBase } from '@cqrs-toolkit/demo-base/notebooks/shared'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import { notebookHandlers } from './executor.js'

interface ServerNotebook extends NotebookBase {
  readonly id: string
}

const updateRegistration = notebookHandlers.find((r) => r.commandType === 'nb.UpdateNotebookName')
if (updateRegistration?.validateAsync === undefined) {
  throw new Error('nb.UpdateNotebookName registration missing validateAsync (fixture invariant)')
}
type UpdateCommand = Parameters<NonNullable<typeof updateRegistration.validateAsync>>[0]
const validateAsync = updateRegistration.validateAsync.bind(updateRegistration)

function stubContext(notebooks: ServerNotebook[]): AsyncValidationContext<ServiceLink> {
  const qm: Pick<IQueryManager<ServiceLink>, 'list'> = {
    async list<T>() {
      const cacheKey: CacheKeyIdentity<ServiceLink<string, string, string>> = {
        key: 'nb.notebooks/seed',
        kind: 'scope',
        scopeType: 'notebooks',
      }
      const data = notebooks as T
      return {
        data,
        meta: notebooks.map((n) => ({ id: n.id, updatedAt: 0, revision: n.latestRevision })),
        total: notebooks.length,
        hasLocalChanges: false,
        cacheKey,
      }
    },
  }
  const queryManager = qm as IQueryManager<ServiceLink>
  return { queryManager }
}

function notebook(id: string, name: string): ServerNotebook {
  return {
    id,
    name,
    tags: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    latestRevision: '0',
  }
}

function command(id: string, name: string): UpdateCommand {
  return {
    type: 'nb.UpdateNotebookName',
    data: { name },
    path: { id },
  }
}

describe('nb.UpdateNotebookName validateAsync', () => {
  it('returns a redundant ConflictException when target name matches current name', async () => {
    const notebookA = notebook('A', 'Shared Target')
    const ctx = stubContext([notebookA])
    const res = await validateAsync(
      command('A', 'Shared Target'),
      { mode: 'initial', initial: notebookA },
      ctx,
    )

    expect(res.ok).toBe(false)
    if (res.ok) throw new Error('expected Err')
    expect(isConflict(res.error)).toBe(true)
    expect(isRedundant(res.error)).toBe(true)
    expect(res.error).toBeInstanceOf(ConflictException)
    expect((res.error as ConflictException).errorCode).toBe('nb.RedundantNameUpdate')
  })

  it('returns a ValidationException when another notebook already holds the target name', async () => {
    const notebookA = notebook('A', 'Original')
    const ctx = stubContext([notebookA, notebook('B', 'Taken')])
    const res = await validateAsync(
      command('A', 'Taken'),
      { mode: 'initial', initial: notebookA },
      ctx,
    )

    expect(res.ok).toBe(false)
    if (res.ok) throw new Error('expected Err')
    expect(res.error).toBeInstanceOf(ValidationException)
    expect(isConflict(res.error)).toBe(false)
  })

  it('returns Ok when the target name is free and differs from current', async () => {
    const notebookA = notebook('A', 'Original')
    const ctx = stubContext([notebookA, notebook('B', 'Other')])
    const res = await validateAsync(
      command('A', 'Brand New'),
      { mode: 'initial', initial: notebookA },
      ctx,
    )

    expect(res.ok).toBe(true)
  })
})
