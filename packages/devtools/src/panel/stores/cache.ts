/**
 * Cache store — manages cache key state for the Cache tab.
 *
 * Processes cache-related library events to maintain a live view of
 * cache key acquisitions and evictions.
 */

import { createMemo, createSignal } from 'solid-js'
import type { SanitizedEvent } from '../../shared/protocol.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CacheKeyStatus = 'active' | 'evicted'

const ALL_STATUSES: CacheKeyStatus[] = ['active', 'evicted']

export interface CacheKeyEntry {
  key: string
  collection: string
  params: Record<string, unknown> | undefined
  evictionPolicy: string
  status: CacheKeyStatus
  acquiredAt: number
  evictedAt: number | undefined
  evictionReason: string | undefined
}

export interface CacheStore {
  entries: () => CacheKeyEntry[]
  filteredEntries: () => CacheKeyEntry[]
  collectionFilter: () => Set<string>
  toggleCollectionFilter: (v: string) => void
  selectAllCollections: () => void
  clearCollectionFilter: () => void
  statusFilter: () => Set<CacheKeyStatus>
  toggleStatusFilter: (v: CacheKeyStatus) => void
  selectAllStatuses: () => void
  clearStatusFilter: () => void
  filterVersion: () => number
  seenCollections: () => string[]
  selectedId: () => string | undefined
  selectEntry: (key: string | undefined) => void
  selectedEntry: () => CacheKeyEntry | undefined
  handleEvent: (event: SanitizedEvent) => void
  clear: () => void
  exportJson: () => string
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createCacheStore(): CacheStore {
  const [entries, setEntries] = createSignal<Map<string, CacheKeyEntry>>(new Map())
  const [seenCollections, setSeenCollections] = createSignal<Set<string>>(new Set())

  const [collectionFilter, setCollectionFilter] = createSignal<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = createSignal<Set<CacheKeyStatus>>(new Set(ALL_STATUSES))
  const [filterVersion, setFilterVersion] = createSignal(0)
  const [selectedId, setSelectedId] = createSignal<string | undefined>()

  function bumpFilterVersion(): void {
    setFilterVersion((v) => v + 1)
  }

  function entriesList(): CacheKeyEntry[] {
    return Array.from(entries().values())
  }

  const filteredEntries = createMemo(() => {
    const all = entriesList()
    const col = collectionFilter()
    const status = statusFilter()
    return all.filter((e) => {
      if (col.size > 0 && !col.has(e.collection)) return false
      if (!status.has(e.status)) return false
      return true
    })
  })

  function handleEvent(event: SanitizedEvent): void {
    switch (event.type) {
      case 'cache:key-acquired': {
        const key = event.data['cacheKey'] as string | undefined
        if (!key) return

        const collection = (event.data['collection'] as string) ?? ''
        const params = event.data['params'] as Record<string, unknown> | undefined
        const evictionPolicy = (event.data['evictionPolicy'] as string) ?? 'passive'

        const entry: CacheKeyEntry = {
          key,
          collection,
          params,
          evictionPolicy,
          status: 'active',
          acquiredAt: event.timestamp,
          evictedAt: undefined,
          evictionReason: undefined,
        }

        setEntries((prev) => {
          const next = new Map(prev)
          next.set(key, entry)
          return next
        })

        setSeenCollections((prev) => {
          if (prev.has(collection)) return prev
          const next = new Set(prev)
          next.add(collection)
          return next
        })
        break
      }

      case 'cache:evicted': {
        const key = event.data['cacheKey'] as string | undefined
        if (!key) return

        setEntries((prev) => {
          const existing = prev.get(key)
          if (!existing) return prev
          const next = new Map(prev)
          next.set(key, {
            ...existing,
            status: 'evicted',
            evictedAt: event.timestamp,
            evictionReason: (event.data['reason'] as string) ?? undefined,
          })
          return next
        })
        break
      }
    }
  }

  function clear(): void {
    setEntries(new Map())
    setSeenCollections(new Set<CacheKeyStatus>())
    setCollectionFilter(new Set<CacheKeyStatus>())
    setStatusFilter(new Set(ALL_STATUSES))
    setSelectedId(undefined)
  }

  return {
    entries: entriesList,
    filteredEntries,
    collectionFilter,
    toggleCollectionFilter(v) {
      setCollectionFilter((prev) => {
        const next = new Set(prev)
        if (next.has(v)) next.delete(v)
        else next.add(v)
        return next
      })
      bumpFilterVersion()
    },
    selectAllCollections() {
      setCollectionFilter(new Set(seenCollections()))
      bumpFilterVersion()
    },
    clearCollectionFilter() {
      setCollectionFilter(new Set<CacheKeyStatus>())
      bumpFilterVersion()
    },
    statusFilter,
    toggleStatusFilter(v) {
      setStatusFilter((prev) => {
        const next = new Set(prev)
        if (next.has(v)) next.delete(v)
        else next.add(v)
        return next
      })
      bumpFilterVersion()
    },
    selectAllStatuses() {
      setStatusFilter(new Set(ALL_STATUSES))
      bumpFilterVersion()
    },
    clearStatusFilter() {
      setStatusFilter(new Set<CacheKeyStatus>())
      bumpFilterVersion()
    },
    filterVersion,
    seenCollections: () => Array.from(seenCollections()).sort(),
    selectedId,
    selectEntry: setSelectedId,
    selectedEntry() {
      const id = selectedId()
      if (!id) return undefined
      return entries().get(id)
    },
    handleEvent,
    clear,
    exportJson() {
      return JSON.stringify(entriesList(), null, 2)
    },
  }
}
