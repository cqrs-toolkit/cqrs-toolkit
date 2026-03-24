/**
 * Read Models store — manages read model collection state for the Read Models tab.
 *
 * Aggregates cache key acquisitions and read model updates to show
 * per-collection statistics and update history.
 */

import { createMemo, createSignal } from 'solid-js'
import type { SanitizedEvent } from '../../shared/protocol.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UpdateHistoryEntry {
  timestamp: number
  ids: string[]
}

export interface ReadModelCollectionEntry {
  collection: string
  cacheKeys: Set<string>
  entityIds: Set<string>
  updateCount: number
  lastUpdateAt: number | undefined
  updateHistory: UpdateHistoryEntry[]
}

export interface ReadModelsStore {
  entries: () => ReadModelCollectionEntry[]
  filteredEntries: () => ReadModelCollectionEntry[]
  collectionFilter: () => Set<string>
  toggleCollectionFilter: (v: string) => void
  selectAllCollections: () => void
  clearCollectionFilter: () => void
  filterVersion: () => number
  seenCollections: () => string[]
  selectedCollection: () => string | undefined
  selectCollection: (c: string | undefined) => void
  selectedEntry: () => ReadModelCollectionEntry | undefined
  handleEvent: (event: SanitizedEvent) => void
  clear: () => void
  exportJson: () => string
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createReadModelsStore(): ReadModelsStore {
  const [collections, setCollections] = createSignal<Map<string, ReadModelCollectionEntry>>(
    new Map(),
  )
  const [seenCollections, setSeenCollections] = createSignal<Set<string>>(new Set())

  const [collectionFilter, setCollectionFilter] = createSignal<Set<string>>(new Set())
  const [filterVersion, setFilterVersion] = createSignal(0)
  const [selectedCollection, setSelectedCollection] = createSignal<string | undefined>()

  function bumpFilterVersion(): void {
    setFilterVersion((v) => v + 1)
  }

  function entriesList(): ReadModelCollectionEntry[] {
    return Array.from(collections().values())
  }

  const filteredEntries = createMemo(() => {
    const all = entriesList()
    const col = collectionFilter()
    if (col.size === 0) return all
    return all.filter((e) => col.has(e.collection))
  })

  function getOrCreateCollection(
    map: Map<string, ReadModelCollectionEntry>,
    collection: string,
  ): ReadModelCollectionEntry {
    const existing = map.get(collection)
    if (existing) return existing
    return {
      collection,
      cacheKeys: new Set(),
      entityIds: new Set(),
      updateCount: 0,
      lastUpdateAt: undefined,
      updateHistory: [],
    }
  }

  function trackCollection(collection: string): void {
    setSeenCollections((prev) => {
      if (prev.has(collection)) return prev
      const next = new Set(prev)
      next.add(collection)
      return next
    })
  }

  function handleEvent(event: SanitizedEvent): void {
    switch (event.type) {
      case 'cache:key-acquired': {
        const cacheKey = event.data['cacheKey'] as string | undefined
        if (!cacheKey) return
        const collection = (event.data['collection'] as string) ?? ''

        trackCollection(collection)
        setCollections((prev) => {
          const next = new Map(prev)
          const entry = getOrCreateCollection(prev, collection)
          const newCacheKeys = new Set(entry.cacheKeys)
          newCacheKeys.add(cacheKey)
          next.set(collection, { ...entry, cacheKeys: newCacheKeys })
          return next
        })
        break
      }

      case 'readmodel:updated': {
        const collection = (event.data['collection'] as string) ?? ''
        const ids = (event.data['ids'] as string[]) ?? []

        trackCollection(collection)
        setCollections((prev) => {
          const next = new Map(prev)
          const entry = getOrCreateCollection(prev, collection)
          const newEntityIds = new Set(entry.entityIds)
          for (const id of ids) {
            newEntityIds.add(id)
          }
          const historyEntry: UpdateHistoryEntry = { timestamp: event.timestamp, ids }
          next.set(collection, {
            ...entry,
            entityIds: newEntityIds,
            updateCount: entry.updateCount + 1,
            lastUpdateAt: event.timestamp,
            updateHistory: [...entry.updateHistory, historyEntry],
          })
          return next
        })
        break
      }
    }
  }

  function clear(): void {
    setCollections(new Map())
    setSeenCollections(new Set<string>())
    setCollectionFilter(new Set<string>())
    setSelectedCollection(undefined)
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
      setCollectionFilter(new Set<string>())
      bumpFilterVersion()
    },
    filterVersion,
    seenCollections: () => Array.from(seenCollections()).sort(),
    selectedCollection,
    selectCollection: setSelectedCollection,
    selectedEntry() {
      const col = selectedCollection()
      if (!col) return undefined
      return collections().get(col)
    },
    handleEvent,
    clear,
    exportJson() {
      const entries = entriesList().map((entry) => ({
        ...entry,
        cacheKeys: Array.from(entry.cacheKeys),
        entityIds: Array.from(entry.entityIds),
      }))
      return JSON.stringify(entries, null, 2)
    },
  }
}
