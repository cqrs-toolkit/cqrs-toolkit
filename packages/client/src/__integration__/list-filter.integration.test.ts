/**
 * Integration tests for per-call `list` / `watchList` filter and sort.
 *
 * Domain: `nb.Notebook` notebooks with `status` and `priority` declared
 * as custom columns. Exercises:
 *
 * - `ListFilter` ships both backend implementations — `memory(row, params)`
 *   for the in-memory single-pass scan, `sql(params)` for the SQLite
 *   WHERE composition. The library wraps the user fragment as
 *   `WHERE <cache-key> AND (<user>)`; tests author OR-groups to verify
 *   the parens scope cannot leak past the cache key.
 * - `total` reflects the filtered count (not the raw cache-key-scoped
 *   count) — list UIs use the same number under `data` and under
 *   "showing X of Y".
 * - Per-call `sort` overrides `Collection.list.defaultSort`; both
 *   sort references custom columns.
 * - `watchList` re-emits on tracked-id updates and on count changes.
 *
 * Runs against both bootstrap variants (`online-only` against
 * InMemoryStorage; `worker-side` against SQLiteStorage via better-sqlite3).
 */

import type { ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import type { ListFilter, Sort } from '../core/query-manager/types.js'
import { clientSchema } from '../storage/schema/client-schema.js'
import {
  NotebookAggregate,
  bootstrapVariants,
  createRun,
  integrationTestOptions,
} from '../testing/index.js'
import type { Collection, ManagedCollectionDef, SchemaMigration } from '../types/config.js'

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

interface NotebookData {
  id: string
  ownerId: string
  title: string
  status: 'active' | 'archived'
  priority: number
}

const NOTEBOOKS_MANAGED: ManagedCollectionDef = {
  type: 'managed',
  name: 'notebooks',
  columns: [
    { name: 'owner_id', type: 'TEXT', path: '$.ownerId' },
    { name: 'status', type: 'TEXT', path: '$.status' },
    { name: 'priority', type: 'INTEGER', path: '$.priority' },
  ],
  indexes: [{ columns: ['owner_id', 'status'] }, { columns: ['priority'] }],
}

const MIGRATIONS: [SchemaMigration, ...SchemaMigration[]] = [
  {
    version: 1,
    message: 'notebooks with declared columns',
    steps: [clientSchema.init, NOTEBOOKS_MANAGED],
  },
]

function notebooksCollection(opts?: {
  total?: boolean
  defaultSort?: Sort
}): Collection<ServiceLink> {
  return {
    name: 'notebooks',
    aggregate: NotebookAggregate,
    matchesStream: (s) => s.startsWith('nb.Notebook-'),
    cacheKeysFromTopics: () => [],
    list: {
      ...(opts?.total ? { total: true } : {}),
      ...(opts?.defaultSort ? { defaultSort: opts.defaultSort } : {}),
    },
  }
}

// ---------------------------------------------------------------------------
// Filter authors — closures over per-call params, mirroring real call-site usage
// ---------------------------------------------------------------------------

/**
 * Filter for "status = 'active' OR priority >= threshold" — exercises the
 * library's outer parens wrapping (the OR group must not leak past the
 * cache-key clause).
 */
function activeOrHighPriorityFilter(threshold: number): ListFilter {
  return {
    params: { threshold },
    memory: (row, p) => {
      const r = row as NotebookData
      const { threshold: t } = p as { threshold: number }
      return r.status === 'active' || r.priority >= t
    },
    sql: (p) => {
      const { threshold: t } = p as { threshold: number }
      return {
        sql: 'status = ? OR priority >= ?',
        bindings: ['active', t],
      }
    },
  }
}

function statusFilter(status: NotebookData['status']): ListFilter {
  return {
    params: { status },
    memory: (row, p) => (row as NotebookData).status === (p as { status: string }).status,
    sql: (p) => ({ sql: 'status = ?', bindings: [(p as { status: string }).status] }),
  }
}

// ---------------------------------------------------------------------------
// Seed helper — registers cache key + writes a batch of notebooks
// ---------------------------------------------------------------------------

async function seedNotebooks(
  ctx: {
    cacheManager: import('../core/cache-manager/types.js').ICacheManagerInternal<ServiceLink>
    readModelStore: import('../core/read-model-store/ReadModelStore.js').ReadModelStore<
      ServiceLink,
      import('../types/commands.js').EnqueueCommand
    >
  },
  notebooks: readonly NotebookData[],
): Promise<import('../core/cache-manager/CacheKey.js').CacheKeyIdentity<ServiceLink>> {
  const identity = await ctx.cacheManager.registerCacheKey({
    kind: 'scope',
    scopeType: 'notebooks',
  })
  for (const n of notebooks) {
    await ctx.readModelStore.setServerData<NotebookData>('notebooks', n.id, n, identity.key)
  }
  return identity
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.each(bootstrapVariants)('$name list filter / sort', ({ bootstrap }) => {
  const run = createRun(bootstrap)

  it(
    'list applies user filter under the cache-key clause (status = ?)',
    integrationTestOptions,
    run(
      {
        collections: [notebooksCollection({ total: true })],
        migrations: MIGRATIONS,
      },
      async (ctx) => {
        const identity = await seedNotebooks(ctx, [
          { id: 'nb1', ownerId: 'u1', title: 'A', status: 'active', priority: 1 },
          { id: 'nb2', ownerId: 'u1', title: 'B', status: 'archived', priority: 1 },
          { id: 'nb3', ownerId: 'u1', title: 'C', status: 'active', priority: 1 },
          { id: 'nb4', ownerId: 'u1', title: 'D', status: 'archived', priority: 1 },
        ])

        const result = await ctx.client.queryManager.list<NotebookData>({
          collection: 'notebooks',
          cacheKey: identity,
          filter: statusFilter('active'),
          sort: [{ column: 'id', direction: 'asc' }],
        })

        expect(result.data.map((r) => r.id)).toEqual(['nb1', 'nb3'])
        // Filtered total — not the raw cache-key count of 4.
        expect(result.total).toBe(2)
      },
    ),
  )

  it(
    'list with OR-group filter keeps the cache-key scope (library wraps in parens)',
    integrationTestOptions,
    run(
      {
        collections: [notebooksCollection({ total: true })],
        migrations: MIGRATIONS,
      },
      async (ctx) => {
        const identity = await seedNotebooks(ctx, [
          // u1 cache key — only these should ever appear in results.
          { id: 'nb1', ownerId: 'u1', title: 'A', status: 'active', priority: 1 },
          { id: 'nb2', ownerId: 'u1', title: 'B', status: 'archived', priority: 10 },
          { id: 'nb3', ownerId: 'u1', title: 'C', status: 'archived', priority: 2 },
        ])
        // A second cache key holding a notebook that satisfies the user
        // filter — must NOT appear: cache_key clause excludes it.
        const otherIdentity = await ctx.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'other-bucket',
        })
        await ctx.readModelStore.setServerData<NotebookData>(
          'notebooks',
          'nbOther',
          { id: 'nbOther', ownerId: 'u2', title: 'Other', status: 'active', priority: 999 },
          otherIdentity.key,
        )

        const result = await ctx.client.queryManager.list<NotebookData>({
          collection: 'notebooks',
          cacheKey: identity,
          // status = 'active' OR priority >= 5
          filter: activeOrHighPriorityFilter(5),
          sort: [{ column: 'id', direction: 'asc' }],
        })

        expect(result.data.map((r) => r.id)).toEqual(['nb1', 'nb2'])
        expect(result.data.some((r) => r.id === 'nbOther')).toBe(false)
        expect(result.total).toBe(2)
      },
    ),
  )

  it(
    'list applies the per-call sort over the collection default sort',
    integrationTestOptions,
    run(
      {
        collections: [
          notebooksCollection({
            // Default ASC by id; the per-call sort below overrides to DESC priority.
            defaultSort: [{ column: 'id', direction: 'asc' }],
          }),
        ],
        migrations: MIGRATIONS,
      },
      async (ctx) => {
        const identity = await seedNotebooks(ctx, [
          { id: 'nb1', ownerId: 'u1', title: 'A', status: 'active', priority: 3 },
          { id: 'nb2', ownerId: 'u1', title: 'B', status: 'active', priority: 1 },
          { id: 'nb3', ownerId: 'u1', title: 'C', status: 'active', priority: 5 },
        ])

        // No sort on the call → default applies.
        const byDefault = await ctx.client.queryManager.list<NotebookData>({
          collection: 'notebooks',
          cacheKey: identity,
        })
        expect(byDefault.data.map((r) => r.id)).toEqual(['nb1', 'nb2', 'nb3'])

        // Per-call sort overrides — priority DESC.
        const byPriority = await ctx.client.queryManager.list<NotebookData>({
          collection: 'notebooks',
          cacheKey: identity,
          sort: [{ column: 'priority', direction: 'desc' }],
        })
        expect(byPriority.data.map((r) => r.id)).toEqual(['nb3', 'nb1', 'nb2'])
      },
    ),
  )

  it(
    'watchList re-emits when an in-page row is updated, respecting the filter',
    integrationTestOptions,
    run(
      {
        collections: [notebooksCollection({ total: true })],
        migrations: MIGRATIONS,
      },
      async (ctx) => {
        const identity = await seedNotebooks(ctx, [
          { id: 'nb1', ownerId: 'u1', title: 'First', status: 'active', priority: 1 },
          { id: 'nb2', ownerId: 'u1', title: 'Two', status: 'archived', priority: 1 },
        ])

        const emissions: { ids: string[]; total: number | undefined }[] = []
        const sub = ctx.client.queryManager
          .watchList<NotebookData>({
            collection: 'notebooks',
            cacheKey: identity,
            filter: statusFilter('active'),
            sort: [{ column: 'id', direction: 'asc' }],
          })
          .subscribe((r) => emissions.push({ ids: r.data.map((d) => d.id), total: r.total }))

        await new Promise((r) => setTimeout(r, 50))
        expect(emissions[0]?.ids).toEqual(['nb1'])
        expect(emissions[0]?.total).toBe(1)
        const before = emissions.length

        // Update an in-page row's title; the readmodel:updated event hits
        // pageIds so the gate re-fetches.
        await ctx.readModelStore.mergeServerData<Partial<NotebookData>>(
          'notebooks',
          'nb1',
          { title: 'First (renamed)' },
          identity.key,
        )
        ctx.eventBus.emit('readmodel:updated', {
          collection: 'notebooks',
          updated: ['nb1'],
          cacheKeys: [identity.key],
          commandIds: [],
        })

        await new Promise((r) => setTimeout(r, 50))
        expect(emissions.length).toBeGreaterThan(before)
        expect(emissions[emissions.length - 1]?.ids).toEqual(['nb1'])

        sub.unsubscribe()
      },
    ),
  )

  it(
    'watchList total reflects the filter — off-page row entering the filter bumps the count',
    integrationTestOptions,
    run(
      {
        collections: [notebooksCollection({ total: true })],
        migrations: MIGRATIONS,
      },
      async (ctx) => {
        const identity = await seedNotebooks(ctx, [
          { id: 'nb1', ownerId: 'u1', title: 'A', status: 'active', priority: 1 },
          { id: 'nb2', ownerId: 'u1', title: 'B', status: 'archived', priority: 1 },
        ])

        const emissions: { ids: string[]; total: number | undefined }[] = []
        const sub = ctx.client.queryManager
          .watchList<NotebookData>({
            collection: 'notebooks',
            // Only show top page (limit 1) so the bigger total is what
            // proves the count branch ran.
            limit: 1,
            cacheKey: identity,
            filter: statusFilter('active'),
            sort: [{ column: 'id', direction: 'asc' }],
          })
          .subscribe((r) => emissions.push({ ids: r.data.map((d) => d.id), total: r.total }))

        await new Promise((r) => setTimeout(r, 50))
        expect(emissions[0]?.ids).toEqual(['nb1'])
        expect(emissions[0]?.total).toBe(1)
        const before = emissions.length

        // Create a new active notebook — off-page (limit 1, id-sorted so
        // nb3 falls beyond nb1). Count branch fires.
        await ctx.readModelStore.setServerData<NotebookData>(
          'notebooks',
          'nb3',
          { id: 'nb3', ownerId: 'u1', title: 'C', status: 'active', priority: 1 },
          identity.key,
        )
        ctx.eventBus.emit('readmodel:updated', {
          collection: 'notebooks',
          created: ['nb3'],
          cacheKeys: [identity.key],
          commandIds: [],
        })

        await new Promise((r) => setTimeout(r, 80))
        expect(emissions.length).toBeGreaterThan(before)
        const last = emissions[emissions.length - 1]
        // Visible page stays as nb1...
        expect(last?.ids).toEqual(['nb1'])
        // ...total advances to 2 (filter-respecting count).
        expect(last?.total).toBe(2)

        sub.unsubscribe()
      },
    ),
  )
})
