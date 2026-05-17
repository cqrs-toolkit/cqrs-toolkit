import {
  ConflictException,
  isConflict,
  isRedundant,
  ValidationException,
  type AsyncValidationContext,
  type IQueryManager,
  type ListQueryResult,
} from '@cqrs-toolkit/client'
import type { Notebook } from '@cqrs-toolkit/demo-base/notebooks/domain'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import { notebookHandlers } from './executor.js'

const updateRegistration = notebookHandlers.find((r) => r.commandType === 'nb.UpdateNotebookName')
if (updateRegistration?.validateAsync === undefined) {
  throw new Error('nb.UpdateNotebookName registration missing validateAsync (fixture invariant)')
}
type UpdateCommand = Parameters<NonNullable<typeof updateRegistration.validateAsync>>[0]
const validateAsync = updateRegistration.validateAsync.bind(updateRegistration)

function stubContext(notebooks: Notebook[]): AsyncValidationContext<ServiceLink> {
  const queryManager = {
    async list(): Promise<ListQueryResult<ServiceLink, Notebook>> {
      return {
        data: notebooks,
        meta: notebooks.map((n) => ({ id: n.id, updatedAt: 0, revision: n.latestRevision })),
        total: notebooks.length,
        hasLocalChanges: false,
        cacheKey: { key: 'nb.notebooks/seed' } as unknown as ListQueryResult<
          ServiceLink,
          Notebook
        >['cacheKey'],
      }
    },
  } as unknown as IQueryManager<ServiceLink>
  return { queryManager }
}

function notebook(id: string, name: string): Notebook {
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
    commandId: 'cmd-1',
    type: 'nb.UpdateNotebookName',
    data: { name },
    path: { id },
  } as unknown as UpdateCommand
}

describe('nb.UpdateNotebookName validateAsync', () => {
  it('returns a redundant ConflictException when target name matches current name', async () => {
    const ctx = stubContext([notebook('A', 'Shared Target')])
    const res = await validateAsync(command('A', 'Shared Target'), undefined, ctx)

    expect(res.ok).toBe(false)
    if (res.ok) throw new Error('expected Err')
    expect(isConflict(res.error)).toBe(true)
    expect(isRedundant(res.error)).toBe(true)
    expect(res.error).toBeInstanceOf(ConflictException)
    expect((res.error as ConflictException).errorCode).toBe('nb.RedundantNameUpdate')
  })

  it('returns a ValidationException when another notebook already holds the target name', async () => {
    const ctx = stubContext([notebook('A', 'Original'), notebook('B', 'Taken')])
    const res = await validateAsync(command('A', 'Taken'), undefined, ctx)

    expect(res.ok).toBe(false)
    if (res.ok) throw new Error('expected Err')
    expect(res.error).toBeInstanceOf(ValidationException)
    expect(isConflict(res.error)).toBe(false)
  })

  it('returns Ok when the target name is free and differs from current', async () => {
    const ctx = stubContext([notebook('A', 'Original'), notebook('B', 'Other')])
    const res = await validateAsync(command('A', 'Brand New'), undefined, ctx)

    expect(res.ok).toBe(true)
  })
})
