/**
 * Integration tests for cross-collection views.
 *
 * Domain: `nb.Notebook` notebooks owned by users, each joined with the
 * **latest** `nb.Note` in that notebook (highest `updatedAt`). Verifies the
 * full pull/watch surface across both bootstrap variants:
 *
 * - `bootstrapOnlineOnly` exercises the in-memory dispatch path
 *   (`memory` closure iterates `InMemoryStorage` and picks the max-updatedAt
 *   note per notebook).
 * - `bootstrapWorkerSide` exercises the SQL dispatch path
 *   (`sql.query` selects each notebook plus its latest note via a correlated
 *   `ORDER BY ... LIMIT 1` subquery against SQLiteStorage via better-sqlite3,
 *   then `sql.transform` reshapes the raw row to the public shape).
 *
 * Same view registration ships both implementations; the bootstrap picks
 * the right dispatcher.
 */

import type { ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it } from 'vitest'
import type { AnyViewRegistration, ViewLocalApi } from '../core/views/types.js'
import {
  NoteAggregate,
  NotebookAggregate,
  bootstrapVariants,
  createRun,
  integrationTestOptions,
} from '../testing/index.js'
import type { Collection } from '../types/config.js'

// ---------------------------------------------------------------------------
// Fixture types and view registration
// ---------------------------------------------------------------------------

interface NotebookData {
  id: string
  ownerId: string
  title: string
}

interface NoteData {
  id: string
  notebookId: string
  title: string
  updatedAt: number
}

interface NotebookWithLatestNote {
  id: string
  ownerId: string
  title: string
  _embedded: { 'nb.Note': NoteData | null }
}

interface SqlRow {
  id: string
  notebook: string
  note: string | null
}

function notebooksCollection(): Collection<ServiceLink> {
  return {
    name: 'notebooks',
    aggregate: NotebookAggregate,
    matchesStream: (s) => s.startsWith('nb.Notebook-'),
    cacheKeysFromTopics: () => [],
  }
}

function notesCollection(): Collection<ServiceLink> {
  return {
    name: 'notes',
    aggregate: NoteAggregate,
    matchesStream: (s) => s.startsWith('nb.Note-'),
    cacheKeysFromTopics: () => [],
  }
}

/**
 * Builds the notebooks-for-owner view. Each visible notebook embeds the
 * single most-recently-updated note belonging to it (null when none exist).
 * When `withCount` is true the registration declares both `memoryCount` and
 * `sql.count`; when false the count branch is dead and the engine drops
 * off-page changes.
 */
function notebooksWithLatestNoteView(opts?: {
  withCount?: boolean
}): AnyViewRegistration<ServiceLink> {
  const view: AnyViewRegistration<ServiceLink> = {
    name: 'notebooks-for-owner',
    primarySource: 'notebooks',
    joinSources: [{ collection: 'notes', referencedIdPath: "$._embedded['nb.Note'].id" }],
    cacheKeys: () => [
      { kind: 'scope', scopeType: 'notebooks' },
      { kind: 'scope', scopeType: 'notes' },
    ],
    memory: (api: ViewLocalApi, params: unknown) => {
      const ownerId = (params as { ownerId: string }).ownerId
      // Bucket notes by notebookId, keeping the max-updatedAt entry per bucket.
      const latestByNotebook = new Map<string, NoteData>()
      for (const n of api.iterate<NoteData>('notes')) {
        const existing = latestByNotebook.get(n.data.notebookId)
        if (!existing || n.data.updatedAt > existing.updatedAt) {
          latestByNotebook.set(n.data.notebookId, n.data)
        }
      }
      const out: NotebookWithLatestNote[] = []
      for (const nb of api.iterate<NotebookData>('notebooks')) {
        if (nb.data.ownerId !== ownerId) continue
        out.push({
          id: nb.data.id,
          ownerId: nb.data.ownerId,
          title: nb.data.title,
          _embedded: { 'nb.Note': latestByNotebook.get(nb.data.id) ?? null },
        })
      }
      out.sort((a, b) => a.id.localeCompare(b.id))
      return out
    },
    ...(opts?.withCount
      ? {
          memoryCount: (api: ViewLocalApi, params: unknown) => {
            const ownerId = (params as { ownerId: string }).ownerId
            let n = 0
            for (const nb of api.iterate<NotebookData>('notebooks')) {
              if (nb.data.ownerId === ownerId) n++
            }
            return n
          },
        }
      : {}),
    sql: {
      query: (params: unknown, _page: unknown) => {
        const ownerId = (params as { ownerId: string }).ownerId
        return {
          sql: `
            SELECT
              nb.id AS id,
              nb._effective_data AS notebook,
              (
                SELECT n._effective_data
                FROM rm_notes n
                WHERE json_extract(n._effective_data, '$.notebookId') = nb.id
                ORDER BY json_extract(n._effective_data, '$.updatedAt') DESC
                LIMIT 1
              ) AS note
            FROM rm_notebooks nb
            WHERE json_extract(nb._effective_data, '$.ownerId') = ?
            ORDER BY nb.id
          `,
          bindings: [ownerId],
        }
      },
      ...(opts?.withCount
        ? {
            count: (params: unknown) => {
              const ownerId = (params as { ownerId: string }).ownerId
              return {
                sql: `
                  SELECT COUNT(*) AS total FROM rm_notebooks
                  WHERE json_extract(_effective_data, '$.ownerId') = ?
                `,
                bindings: [ownerId],
              }
            },
          }
        : {}),
      transform: (row: unknown) => {
        const sqlRow = row as SqlRow
        const notebook = JSON.parse(sqlRow.notebook) as NotebookData
        const note = sqlRow.note ? (JSON.parse(sqlRow.note) as NoteData) : null
        return {
          id: notebook.id,
          ownerId: notebook.ownerId,
          title: notebook.title,
          _embedded: { 'nb.Note': note },
        }
      },
    },
  }
  return view
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.each(bootstrapVariants)('$name views', ({ bootstrap }) => {
  const run = createRun(bootstrap)

  it(
    'getView returns notebooks for an owner, each joined with its latest note',
    integrationTestOptions,
    run(
      {
        collections: [notebooksCollection(), notesCollection()],
        views: [notebooksWithLatestNoteView()],
      },
      async (ctx) => {
        // Register the cache keys via cacheManager so the in-memory registry
        // entries match the UUIDs we'll attribute the seeded rows under. Then
        // `getView`'s internal `registerCacheKey` returns these same
        // identities (looked up by identityStr), and events that fire under
        // these keys match `watchedCacheKeys` cleanly.
        const notebooksKey = await ctx.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'notebooks',
        })
        const notesKey = await ctx.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'notes',
        })

        // u1 owns nb1 (two notes — n1b is the newer one) and nb2 (one note).
        // u2 owns nb3 — excluded by the owner filter.
        await ctx.readModelStore.setServerData<NotebookData>(
          'notebooks',
          'nb1',
          { id: 'nb1', ownerId: 'u1', title: 'Recipes' },
          notebooksKey.key,
        )
        await ctx.readModelStore.setServerData<NotebookData>(
          'notebooks',
          'nb2',
          { id: 'nb2', ownerId: 'u1', title: 'Travel' },
          notebooksKey.key,
        )
        await ctx.readModelStore.setServerData<NotebookData>(
          'notebooks',
          'nb3',
          { id: 'nb3', ownerId: 'u2', title: 'Other' },
          notebooksKey.key,
        )

        await ctx.readModelStore.setServerData<NoteData>(
          'notes',
          'n1a',
          { id: 'n1a', notebookId: 'nb1', title: 'Soup', updatedAt: 100 },
          notesKey.key,
        )
        await ctx.readModelStore.setServerData<NoteData>(
          'notes',
          'n1b',
          { id: 'n1b', notebookId: 'nb1', title: 'Stew', updatedAt: 200 },
          notesKey.key,
        )
        await ctx.readModelStore.setServerData<NoteData>(
          'notes',
          'n2a',
          { id: 'n2a', notebookId: 'nb2', title: 'Lisbon', updatedAt: 50 },
          notesKey.key,
        )

        const result = await ctx.client.queryManager.getView<NotebookWithLatestNote>({
          view: 'notebooks-for-owner',
          params: { ownerId: 'u1' },
        })

        // Full row shape — notebook fields plus the latest-note embed, with
        // the SQL `transform` callback reshaping the raw projection.
        expect(result.data).toEqual([
          {
            id: 'nb1',
            ownerId: 'u1',
            title: 'Recipes',
            _embedded: {
              'nb.Note': { id: 'n1b', notebookId: 'nb1', title: 'Stew', updatedAt: 200 },
            },
          },
          {
            id: 'nb2',
            ownerId: 'u1',
            title: 'Travel',
            _embedded: {
              'nb.Note': { id: 'n2a', notebookId: 'nb2', title: 'Lisbon', updatedAt: 50 },
            },
          },
        ])
        expect(result.cacheKeys).toHaveLength(2)
        // No count callback → no total surfaced.
        expect(result.total).toBeUndefined()
      },
    ),
  )

  it(
    'getView surfaces total when the view declares a count callback',
    integrationTestOptions,
    run(
      {
        collections: [notebooksCollection(), notesCollection()],
        views: [notebooksWithLatestNoteView({ withCount: true })],
      },
      async (ctx) => {
        const notebooksKey = await ctx.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'notebooks',
        })
        const notesKey = await ctx.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'notes',
        })

        // Five notebooks for u1, each with one note; one notebook for u2.
        for (let i = 0; i < 5; i++) {
          await ctx.readModelStore.setServerData<NotebookData>(
            'notebooks',
            `nb${i}`,
            { id: `nb${i}`, ownerId: 'u1', title: `Book ${i}` },
            notebooksKey.key,
          )
          await ctx.readModelStore.setServerData<NoteData>(
            'notes',
            `n${i}`,
            { id: `n${i}`, notebookId: `nb${i}`, title: `Note ${i}`, updatedAt: 100 + i },
            notesKey.key,
          )
        }
        await ctx.readModelStore.setServerData<NotebookData>(
          'notebooks',
          'nbX',
          { id: 'nbX', ownerId: 'u2', title: 'Other' },
          notebooksKey.key,
        )

        const result = await ctx.client.queryManager.getView<NotebookWithLatestNote>({
          view: 'notebooks-for-owner',
          params: { ownerId: 'u1' },
        })
        expect(result.data.map((r) => r.id)).toEqual(['nb0', 'nb1', 'nb2', 'nb3', 'nb4'])
        // Each notebook embeds its (only) note as the "latest".
        expect(result.data[0]?._embedded['nb.Note']?.id).toBe('n0')
        expect(result.data[4]?._embedded['nb.Note']?.id).toBe('n4')
        expect(result.total).toBe(5)
      },
    ),
  )

  it(
    'watchView re-emits when the latest note is updated (tracked-id match on join source)',
    integrationTestOptions,
    run(
      {
        collections: [notebooksCollection(), notesCollection()],
        views: [notebooksWithLatestNoteView()],
      },
      async (ctx) => {
        const notebooksKey = await ctx.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'notebooks',
        })
        const notesKey = await ctx.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'notes',
        })

        await ctx.readModelStore.setServerData<NotebookData>(
          'notebooks',
          'nb1',
          { id: 'nb1', ownerId: 'u1', title: 'Recipes' },
          notebooksKey.key,
        )
        // Two notes — n1b is the latest, so it's the one the embed surfaces
        // and the only note id the row-level tracker holds.
        await ctx.readModelStore.setServerData<NoteData>(
          'notes',
          'n1a',
          { id: 'n1a', notebookId: 'nb1', title: 'Soup', updatedAt: 100 },
          notesKey.key,
        )
        await ctx.readModelStore.setServerData<NoteData>(
          'notes',
          'n1b',
          { id: 'n1b', notebookId: 'nb1', title: 'Stew', updatedAt: 200 },
          notesKey.key,
        )

        const emissions: NotebookWithLatestNote[][] = []
        const sub = ctx.client.queryManager
          .watchView<NotebookWithLatestNote>({
            view: 'notebooks-for-owner',
            params: { ownerId: 'u1' },
          })
          .subscribe((r) => emissions.push(r.data))

        // Initial emission shows the latest note embedded — verifies the
        // transformed shape reached the subscriber.
        await new Promise((r) => setTimeout(r, 50))
        expect(emissions.length).toBeGreaterThanOrEqual(1)
        expect(emissions[0]?.[0]?._embedded['nb.Note']?.id).toBe('n1b')
        expect(emissions[0]?.[0]?._embedded['nb.Note']?.title).toBe('Stew')

        const before = emissions.length

        // Rename the latest note. The view gate's tracked-id branch matches
        // n1b in referencedIds['notes'] and re-fetches. readModelStore writers
        // don't emit events themselves (production emits flow from
        // AnticipatedEventHandler / SyncManager after committing batches);
        // emit explicitly here.
        await ctx.readModelStore.mergeServerData<Partial<NoteData>>(
          'notes',
          'n1b',
          { title: 'Beef Stew' },
          notesKey.key,
        )
        ctx.eventBus.emit('readmodel:updated', {
          collection: 'notes',
          updated: ['n1b'],
          cacheKeys: [notesKey.key],
          commandIds: [],
        })

        await new Promise((r) => setTimeout(r, 50))
        expect(emissions.length).toBeGreaterThan(before)
        const last = emissions[emissions.length - 1]
        expect(last?.[0]?._embedded['nb.Note']?.id).toBe('n1b')
        expect(last?.[0]?._embedded['nb.Note']?.title).toBe('Beef Stew')

        sub.unsubscribe()
      },
    ),
  )

  it(
    'watchView leaves the visible page stable on off-page notebook creates (no count callback)',
    integrationTestOptions,
    run(
      {
        collections: [notebooksCollection(), notesCollection()],
        views: [notebooksWithLatestNoteView()],
      },
      async (ctx) => {
        const notebooksKey = await ctx.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'notebooks',
        })
        const notesKey = await ctx.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'notes',
        })

        await ctx.readModelStore.setServerData<NotebookData>(
          'notebooks',
          'nb1',
          { id: 'nb1', ownerId: 'u1', title: 'First' },
          notebooksKey.key,
        )
        await ctx.readModelStore.setServerData<NoteData>(
          'notes',
          'n1',
          { id: 'n1', notebookId: 'nb1', title: 'Hello', updatedAt: 100 },
          notesKey.key,
        )

        const emissions: NotebookWithLatestNote[][] = []
        const sub = ctx.client.queryManager
          .watchView<NotebookWithLatestNote>({
            view: 'notebooks-for-owner',
            params: { ownerId: 'u1' },
          })
          .subscribe((r) => emissions.push(r.data))

        await new Promise((r) => setTimeout(r, 50))
        expect(emissions.length).toBeGreaterThanOrEqual(1)
        const initialCount = emissions.length

        // Create a new notebook — off-page (not in pageIds). With no count
        // callback, the count branch is dead. Both branches drop the event.
        await ctx.readModelStore.setServerData<NotebookData>(
          'notebooks',
          'nb2',
          { id: 'nb2', ownerId: 'u1', title: 'Second' },
          notebooksKey.key,
        )
        ctx.eventBus.emit('readmodel:updated', {
          collection: 'notebooks',
          created: ['nb2'],
          cacheKeys: [notebooksKey.key],
          commandIds: [],
        })

        await new Promise((r) => setTimeout(r, 80))
        // No new emission — visible page stays stable.
        expect(emissions.length).toBe(initialCount)

        sub.unsubscribe()
      },
    ),
  )

  it(
    'watchView count branch emits a fresh total on off-page creates when configured',
    integrationTestOptions,
    run(
      {
        collections: [notebooksCollection(), notesCollection()],
        views: [notebooksWithLatestNoteView({ withCount: true })],
      },
      async (ctx) => {
        const notebooksKey = await ctx.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'notebooks',
        })
        const notesKey = await ctx.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'notes',
        })

        await ctx.readModelStore.setServerData<NotebookData>(
          'notebooks',
          'nb1',
          { id: 'nb1', ownerId: 'u1', title: 'First' },
          notebooksKey.key,
        )
        await ctx.readModelStore.setServerData<NoteData>(
          'notes',
          'n1',
          { id: 'n1', notebookId: 'nb1', title: 'Hello', updatedAt: 100 },
          notesKey.key,
        )

        const emissions: { rows: number; total: number | undefined }[] = []
        const sub = ctx.client.queryManager
          .watchView<NotebookWithLatestNote>({
            view: 'notebooks-for-owner',
            params: { ownerId: 'u1' },
          })
          .subscribe((r) => emissions.push({ rows: r.data.length, total: r.total }))

        await new Promise((r) => setTimeout(r, 50))
        expect(emissions.length).toBeGreaterThanOrEqual(1)
        expect(emissions[0]?.total).toBe(1)

        const before = emissions.length

        // Off-page create in the same watched cache key — Gate A misses
        // (nb2 not in pageIds), Gate B fires (cache key matches + create).
        await ctx.readModelStore.setServerData<NotebookData>(
          'notebooks',
          'nb2',
          { id: 'nb2', ownerId: 'u1', title: 'Second' },
          notebooksKey.key,
        )
        ctx.eventBus.emit('readmodel:updated', {
          collection: 'notebooks',
          created: ['nb2'],
          cacheKeys: [notebooksKey.key],
          commandIds: [],
        })

        await new Promise((r) => setTimeout(r, 80))
        expect(emissions.length).toBeGreaterThan(before)
        const last = emissions[emissions.length - 1]
        // Visible page rows stay as the previous snapshot...
        expect(last?.rows).toBe(1)
        // ...but the total reflects the new entry.
        expect(last?.total).toBe(2)

        sub.unsubscribe()
      },
    ),
  )
})
