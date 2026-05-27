/**
 * End-to-end coverage for junction-table sync on the SQLite backend.
 *
 * Exercises:
 *
 * 1. Initial create — junction rows materialised from the parent row's array.
 * 2. Update — diff against the prior array: INSERT added ids, DELETE removed.
 *    (`child_value` of unchanged ids is intentionally not touched even when
 *    the array element shape mutates — the spec only diffs the id set.)
 * 3. Delete — `removeAll` clears every pair for the parent.
 * 4. EntityRef-shaped elements — `child_value` populated with the JSON form,
 *    `child_id` set via `entityIdToString`. Plain-string elements get
 *    `child_value` NULL.
 * 5. Cache-key eviction — junction rows for now-orphaned parents are cleaned
 *    via JOIN against the parent's `rm_<parent>_cache_keys` table, before
 *    the cache-key associations themselves are wiped.
 */

import type { ServiceLink } from '@meticoeus/ddd-es'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EventBus } from '../../core/events/EventBus.js'
import { ReadModelStore } from '../../core/read-model-store/ReadModelStore.js'
import { clientSchema } from '../../storage/schema/client-schema.js'
import { getJunctionsByParent } from '../../storage/schema/rm-schema.js'
import { SQLiteStorage } from '../../storage/SQLiteStorage.js'
import { BetterSqliteDb } from '../../testing/BetterSqliteDb.js'
import type { SchemaMigration } from '../../types/config.js'
import { createEntityRef, type EnqueueCommand } from '../../types/index.js'
import { MockCommandIdMappingStore } from '../command-id-mapping-store/ICommandIdMappingStore.mock.js'

interface JunctionRow {
  parent_id: string
  child_id: string
  child_value: string | null
}

const MIGRATIONS: [SchemaMigration, ...SchemaMigration[]] = [
  {
    version: 1,
    message: 'v1',
    steps: [
      clientSchema.init,
      { type: 'managed', name: 'projects' },
      { type: 'managed', name: 'tags' },
    ],
  },
  {
    version: 2,
    message: 'v2: add tag junction',
    steps: [{ type: 'junction', parent: 'projects', name: 'project_tags', path: '$.tagIds[*]' }],
  },
]

async function selectJunction(db: BetterSqliteDb): Promise<JunctionRow[]> {
  return db.exec<JunctionRow>(
    'SELECT parent_id, child_id, child_value FROM rm_project_tags ORDER BY parent_id, child_id',
    { rowMode: 'object', returnValue: 'resultRows' },
  )
}

describe('Junction sync (SQLite)', () => {
  let db: BetterSqliteDb
  let storage: SQLiteStorage<ServiceLink, EnqueueCommand>
  let readModelStore: ReadModelStore<ServiceLink, EnqueueCommand>

  beforeEach(async () => {
    db = new BetterSqliteDb()
    storage = new SQLiteStorage({ db, migrations: MIGRATIONS })
    await storage.initialize()
    const eventBus = new EventBus<ServiceLink>()
    const mappingStore = new MockCommandIdMappingStore()
    readModelStore = new ReadModelStore<ServiceLink, EnqueueCommand>(
      eventBus,
      storage,
      mappingStore,
      getJunctionsByParent(MIGRATIONS),
    )
  })

  afterEach(async () => {
    await storage.close()
  })

  it('materialises junction rows from an initial create with a string-id array', async () => {
    await readModelStore.commit([
      {
        kind: 'setServer',
        collection: 'projects',
        id: 'p1',
        data: { id: 'p1', tagIds: ['t1', 't2', 't3'] },
        cacheKey: 'ck-projects',
        revisionMeta: undefined,
      },
    ])

    const rows = await selectJunction(db)
    expect(rows).toEqual([
      { parent_id: 'p1', child_id: 't1', child_value: null },
      { parent_id: 'p1', child_id: 't2', child_value: null },
      { parent_id: 'p1', child_id: 't3', child_value: null },
    ])
  })

  it('diffs added / removed ids on update; leaves unchanged ids untouched', async () => {
    await readModelStore.commit([
      {
        kind: 'setServer',
        collection: 'projects',
        id: 'p1',
        data: { id: 'p1', tagIds: ['t1', 't2', 't3'] },
        cacheKey: 'ck-projects',
        revisionMeta: undefined,
      },
    ])
    // Array changes: drop t2, add t4.
    await readModelStore.commit([
      {
        kind: 'setServer',
        collection: 'projects',
        id: 'p1',
        data: { id: 'p1', tagIds: ['t1', 't3', 't4'] },
        cacheKey: 'ck-projects',
        revisionMeta: undefined,
      },
    ])

    const rows = await selectJunction(db)
    expect(rows.map((r) => r.child_id)).toEqual(['t1', 't3', 't4'])
  })

  it('clears every pair for the parent on row delete', async () => {
    await readModelStore.commit([
      {
        kind: 'setServer',
        collection: 'projects',
        id: 'p1',
        data: { id: 'p1', tagIds: ['t1', 't2'] },
        cacheKey: 'ck-projects',
        revisionMeta: undefined,
      },
    ])
    await readModelStore.commit([{ kind: 'delete', collection: 'projects', id: 'p1' }])

    expect(await selectJunction(db)).toEqual([])
  })

  it('stores EntityRef elements with json `child_value` and entity-id `child_id`', async () => {
    const ref = createEntityRef('t-server', 'cmd-1', 'temporary')
    await readModelStore.commit([
      {
        kind: 'setServer',
        collection: 'projects',
        id: 'p1',
        data: { id: 'p1', tagIds: [ref, 't-plain'] },
        cacheKey: 'ck-projects',
        revisionMeta: undefined,
      },
    ])
    const rows = await selectJunction(db)
    expect(rows).toHaveLength(2)
    const plain = rows.find((r) => r.child_id === 't-plain')
    expect(plain?.child_value).toBeNull()
    const refRow = rows.find((r) => r.child_id === 't-server')
    expect(refRow?.child_value).not.toBeNull()
    expect(JSON.parse(refRow!.child_value!)).toMatchObject({
      entityId: 't-server',
      commandId: 'cmd-1',
    })
  })

  it('cleans junction rows for parents orphaned by cache-key eviction', async () => {
    // p1 is tagged in only ck-projects (will be evicted). p2 is tagged in
    // ck-projects AND ck-other-scope (survives the eviction).
    await readModelStore.commit([
      {
        kind: 'setServer',
        collection: 'projects',
        id: 'p1',
        data: { id: 'p1', tagIds: ['t1', 't2'] },
        cacheKey: 'ck-projects',
        revisionMeta: undefined,
      },
      {
        kind: 'setServer',
        collection: 'projects',
        id: 'p2',
        data: { id: 'p2', tagIds: ['t3'] },
        cacheKey: 'ck-projects',
        revisionMeta: undefined,
      },
    ])
    await storage.addCacheKeysToReadModel('projects', 'p2', ['ck-other-scope'])

    // Sanity: both parents have junction rows.
    expect(await selectJunction(db)).toEqual([
      { parent_id: 'p1', child_id: 't1', child_value: null },
      { parent_id: 'p1', child_id: 't2', child_value: null },
      { parent_id: 'p2', child_id: 't3', child_value: null },
    ])

    // Evict ck-projects. p1 has no remaining cache key → its junction rows
    // get cleaned via JOIN against rm_projects_cache_keys. p2 survives.
    await storage.removeCacheKeyFromReadModels('ck-projects')

    expect(await selectJunction(db)).toEqual([
      { parent_id: 'p2', child_id: 't3', child_value: null },
    ])
  })

  it('clears all junction rows on deleteReadModelsByCollection', async () => {
    await readModelStore.commit([
      {
        kind: 'setServer',
        collection: 'projects',
        id: 'p1',
        data: { id: 'p1', tagIds: ['t1', 't2'] },
        cacheKey: 'ck-projects',
        revisionMeta: undefined,
      },
    ])
    expect(await selectJunction(db)).toHaveLength(2)

    await storage.deleteReadModelsByCollection('projects')

    expect(await selectJunction(db)).toEqual([])
  })

  it('no-ops when the array is unchanged across commits', async () => {
    await readModelStore.commit([
      {
        kind: 'setServer',
        collection: 'projects',
        id: 'p1',
        data: { id: 'p1', tagIds: ['t1', 't2'] },
        cacheKey: 'ck-projects',
        revisionMeta: undefined,
      },
    ])
    await readModelStore.commit([
      {
        kind: 'setServer',
        collection: 'projects',
        id: 'p1',
        // Same array content but a non-id field updated would write the row
        // but leave the junction untouched. Here the data is identical so the
        // outer no-op short-circuit also skips the row write.
        data: { id: 'p1', tagIds: ['t1', 't2'] },
        cacheKey: 'ck-projects',
        revisionMeta: undefined,
      },
    ])
    expect(await selectJunction(db)).toEqual([
      { parent_id: 'p1', child_id: 't1', child_value: null },
      { parent_id: 'p1', child_id: 't2', child_value: null },
    ])
  })
})
