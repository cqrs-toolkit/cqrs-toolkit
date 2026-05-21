import type { ServiceLink } from '@meticoeus/ddd-es'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BetterSqliteDb } from '../../testing/BetterSqliteDb.js'
import { ViewExecutor, createInMemoryDispatcher, createSqlDispatcher } from './ViewExecutor.js'
import type { AnyViewRegistration, PageRange, ViewLocalApi, ViewRegistration } from './types.js'

interface Project {
  id: string
  workspaceId: string
  title: string
}

const NOOP_CACHE_KEYS = () => []

function makeMemoryView(
  overrides?: Partial<ViewRegistration<ServiceLink, { workspaceId: string }, Project, Project>>,
): AnyViewRegistration<ServiceLink> {
  const view: ViewRegistration<ServiceLink, { workspaceId: string }, Project, Project> = {
    name: 'projects-in-workspace',
    primarySource: 'projects',
    joinSources: [],
    cacheKeys: NOOP_CACHE_KEYS,
    memory: (api, params) => {
      const out: Project[] = []
      for (const row of api.iterate<Project>('projects')) {
        if (row.data.workspaceId === params.workspaceId) out.push(row.data)
      }
      return out
    },
    sql: {
      query: () => ({ sql: 'SELECT 1', bindings: [] }),
    },
    ...overrides,
  }
  return view
}

describe('ViewExecutor (in-memory dispatch)', () => {
  function makeApi(projects: Project[]): ViewLocalApi {
    return {
      *iterate<T>(collection: string) {
        if (collection !== 'projects') return
        for (const p of projects) {
          yield { id: p.id, data: p as unknown as T, hasLocalChanges: false }
        }
      },
    }
  }

  it('routes a memory view through its memory closure', async () => {
    const projects = [
      { id: 'p1', workspaceId: 'w1', title: 'Alpha' },
      { id: 'p2', workspaceId: 'w2', title: 'Beta' },
      { id: 'p3', workspaceId: 'w1', title: 'Gamma' },
    ]
    const executor = new ViewExecutor<ServiceLink>(
      [makeMemoryView()],
      createInMemoryDispatcher(makeApi(projects)),
    )

    const result = await executor.execute('projects-in-workspace', { workspaceId: 'w1' }, undefined)
    const rows = result.rows as Project[]
    expect(rows.map((r) => r.id)).toEqual(['p1', 'p3'])
    expect(result.total).toBeUndefined()
  })

  it('applies offset pagination on the memory path', async () => {
    const projects = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i + 1}`,
      workspaceId: 'w1',
      title: `T${i + 1}`,
    }))
    const executor = new ViewExecutor<ServiceLink>(
      [makeMemoryView()],
      createInMemoryDispatcher(makeApi(projects)),
    )

    const page: PageRange = { kind: 'offset', limit: 2, offset: 2 }
    const result = await executor.execute('projects-in-workspace', { workspaceId: 'w1' }, page)
    const rows = result.rows as Project[]
    expect(rows.map((r) => r.id)).toEqual(['p3', 'p4'])
  })

  it('throws on duplicate view registration', () => {
    expect(
      () =>
        new ViewExecutor<ServiceLink>(
          [makeMemoryView(), makeMemoryView()],
          createInMemoryDispatcher(makeApi([])),
        ),
    ).toThrow(/Duplicate view registration/)
  })

  it('throws at registration when a joinSource fromPath is syntactically invalid', () => {
    const bad = makeMemoryView({
      joinSources: [{ collection: 'assets', fromPath: `$._embedded['pms.Asset"].id` }],
    })
    expect(
      () => new ViewExecutor<ServiceLink>([bad], createInMemoryDispatcher(makeApi([]))),
    ).toThrow(/Invalid fromPath on view 'projects-in-workspace'.*Unterminated bracket member/)
  })

  it('accepts double-quoted bracket members in joinSource paths', () => {
    const view = makeMemoryView({
      joinSources: [{ collection: 'assets', fromPath: '$._embedded["pms.Asset"].id' }],
    })
    expect(
      () => new ViewExecutor<ServiceLink>([view], createInMemoryDispatcher(makeApi([]))),
    ).not.toThrow()
  })

  it('throws on unknown view name', async () => {
    const executor = new ViewExecutor<ServiceLink>(
      [makeMemoryView()],
      createInMemoryDispatcher(makeApi([])),
    )
    await expect(executor.execute('missing', {}, undefined)).rejects.toThrow(/Unknown view/)
  })

  it('surfaces memoryCount as total when configured', async () => {
    const projects = [
      { id: 'p1', workspaceId: 'w1', title: 'Alpha' },
      { id: 'p2', workspaceId: 'w2', title: 'Beta' },
      { id: 'p3', workspaceId: 'w1', title: 'Gamma' },
    ]
    const view = makeMemoryView({
      memoryCount: (api, params) => {
        let n = 0
        for (const row of api.iterate<Project>('projects')) {
          if (row.data.workspaceId === (params as { workspaceId: string }).workspaceId) n++
        }
        return n
      },
    })
    const executor = new ViewExecutor<ServiceLink>(
      [view],
      createInMemoryDispatcher(makeApi(projects)),
    )
    const result = await executor.execute(
      'projects-in-workspace',
      { workspaceId: 'w1' },
      { kind: 'offset', limit: 1, offset: 0 },
    )
    expect((result.rows as Project[]).map((r) => r.id)).toEqual(['p1'])
    // Total counts the full filtered set, ignoring the LIMIT 1.
    expect(result.total).toBe(2)
  })

  it('omits total when memoryCount is absent', async () => {
    const view = makeMemoryView()
    const executor = new ViewExecutor<ServiceLink>([view], createInMemoryDispatcher(makeApi([])))
    const result = await executor.execute('projects-in-workspace', { workspaceId: 'w1' }, undefined)
    expect(result.total).toBeUndefined()
  })
})

describe('ViewExecutor (SQL dispatch)', () => {
  let db: BetterSqliteDb
  beforeEach(() => {
    db = new BetterSqliteDb()
  })
  afterEach(async () => {
    await db.close()
  })

  it('runs a SQL query and returns raw rows when no transform', async () => {
    await db.exec(`CREATE TABLE rm_projects (
      id TEXT PRIMARY KEY,
      _effective_data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`)
    await db.exec(`INSERT INTO rm_projects VALUES ('p1', '{"workspaceId":"w1"}', 1)`)
    await db.exec(`INSERT INTO rm_projects VALUES ('p2', '{"workspaceId":"w2"}', 2)`)
    await db.exec(`INSERT INTO rm_projects VALUES ('p3', '{"workspaceId":"w1"}', 3)`)

    const view: ViewRegistration<
      ServiceLink,
      { workspaceId: string },
      { id: string; _effective_data: string }
    > = {
      name: 'projects-in-workspace',
      primarySource: 'projects',
      joinSources: [],
      cacheKeys: NOOP_CACHE_KEYS,
      memory: () => [],
      sql: {
        query: (params) => ({
          sql: `SELECT id, _effective_data FROM rm_projects
                WHERE json_extract(_effective_data, '$.workspaceId') = ?
                ORDER BY id`,
          bindings: [params.workspaceId],
        }),
      },
    }
    const executor = new ViewExecutor<ServiceLink>([view], createSqlDispatcher(db))

    const result = await executor.execute('projects-in-workspace', { workspaceId: 'w1' }, undefined)
    const rows = result.rows as { id: string; _effective_data: string }[]
    expect(rows.map((r) => r.id)).toEqual(['p1', 'p3'])
  })

  it('applies the transform per row', async () => {
    await db.exec(`CREATE TABLE rm_projects (
      id TEXT PRIMARY KEY,
      _effective_data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`)
    await db.exec(`INSERT INTO rm_projects VALUES ('p1', '{"id":"p1","title":"Alpha"}', 1)`)

    interface SqlRow {
      id: string
      project: string
    }
    interface ProjectShape {
      id: string
      title: string
    }
    const view: ViewRegistration<ServiceLink, unknown, SqlRow, ProjectShape> = {
      name: 'projects-shaped',
      primarySource: 'projects',
      joinSources: [],
      cacheKeys: NOOP_CACHE_KEYS,
      memory: () => [],
      sql: {
        query: () => ({
          sql: 'SELECT id, _effective_data AS project FROM rm_projects',
          bindings: [],
        }),
        transform: (row) => JSON.parse(row.project) as ProjectShape,
      },
    }
    const executor = new ViewExecutor<ServiceLink>([view], createSqlDispatcher(db))

    const result = await executor.execute('projects-shaped', {}, undefined)
    const rows = result.rows as ProjectShape[]
    expect(rows).toEqual([{ id: 'p1', title: 'Alpha' }])
  })

  it('runs sql.count alongside the data query and surfaces total', async () => {
    await db.exec(`CREATE TABLE rm_projects (
      id TEXT PRIMARY KEY,
      _effective_data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`)
    for (let i = 0; i < 10; i++) {
      await db.exec(
        `INSERT INTO rm_projects VALUES ('p${i}', '{"id":"p${i}","workspaceId":"w1"}', ${i})`,
      )
    }
    await db.exec(`INSERT INTO rm_projects VALUES ('q1', '{"id":"q1","workspaceId":"w2"}', 0)`)

    const view: ViewRegistration<
      ServiceLink,
      { workspaceId: string },
      { id: string; _effective_data: string }
    > = {
      name: 'projects-counted',
      primarySource: 'projects',
      joinSources: [],
      cacheKeys: NOOP_CACHE_KEYS,
      memory: () => [],
      sql: {
        query: (params) => ({
          sql: `SELECT id, _effective_data FROM rm_projects
                WHERE json_extract(_effective_data, '$.workspaceId') = ?
                ORDER BY id LIMIT 3`,
          bindings: [params.workspaceId],
        }),
        count: (params) => ({
          sql: `SELECT COUNT(*) AS total FROM rm_projects
                WHERE json_extract(_effective_data, '$.workspaceId') = ?`,
          bindings: [params.workspaceId],
        }),
      },
    }
    const executor = new ViewExecutor<ServiceLink>([view], createSqlDispatcher(db))

    const result = await executor.execute('projects-counted', { workspaceId: 'w1' }, undefined)
    expect((result.rows as { id: string }[]).map((r) => r.id)).toEqual(['p0', 'p1', 'p2'])
    expect(result.total).toBe(10)
  })

  it('omits total when sql.count is absent', async () => {
    await db.exec(`CREATE TABLE rm_projects (
      id TEXT PRIMARY KEY,
      _effective_data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`)

    const view: ViewRegistration<ServiceLink, unknown, { id: string; _effective_data: string }> = {
      name: 'projects-uncounted',
      primarySource: 'projects',
      joinSources: [],
      cacheKeys: NOOP_CACHE_KEYS,
      memory: () => [],
      sql: { query: () => ({ sql: 'SELECT * FROM rm_projects', bindings: [] }) },
    }
    const executor = new ViewExecutor<ServiceLink>([view], createSqlDispatcher(db))
    const result = await executor.execute('projects-uncounted', {}, undefined)
    expect(result.total).toBeUndefined()
  })
})

describe('better-sqlite3 sanity', () => {
  it('runs', () => {
    const db = new Database(':memory:')
    db.exec('CREATE TABLE t (x INTEGER)')
    db.exec('INSERT INTO t VALUES (1)')
    const row = db.prepare('SELECT x FROM t').get() as { x: number }
    expect(row.x).toBe(1)
    db.close()
  })
})
