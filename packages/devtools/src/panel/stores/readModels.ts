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
  collectionFilter: () => string
  setCollectionFilter: (v: string) => void
  filterVersion: () => number
  selectedCollection: () => string | undefined
  selectCollection: (c: string | undefined) => void
  selectedEntry: () => ReadModelCollectionEntry | undefined
  handleEvent: (event: SanitizedEvent) => void
  clear: () => void
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createReadModelsStore(): ReadModelsStore {
  const [collections, setCollections] = createSignal<Map<string, ReadModelCollectionEntry>>(
    new Map(),
  )

  const [collectionFilter, setCollectionFilterRaw] = createSignal('')
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
    const filter = collectionFilter().toLowerCase()
    if (!filter) return all
    return all.filter((e) => e.collection.toLowerCase().includes(filter))
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

  function handleEvent(event: SanitizedEvent): void {
    switch (event.type) {
      case 'cache:key-acquired': {
        const cacheKey = event.payload['cacheKey'] as string | undefined
        if (!cacheKey) return
        const collection = (event.payload['collection'] as string) ?? ''

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
        const collection = (event.payload['collection'] as string) ?? ''
        const ids = (event.payload['ids'] as string[]) ?? []

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
    setSelectedCollection(undefined)
  }

  return {
    entries: entriesList,
    filteredEntries,
    collectionFilter,
    setCollectionFilter(v) {
      setCollectionFilterRaw(v)
      bumpFilterVersion()
    },
    filterVersion,
    selectedCollection,
    selectCollection: setSelectedCollection,
    selectedEntry() {
      const col = selectedCollection()
      if (!col) return undefined
      return collections().get(col)
    },
    handleEvent,
    clear,
  }
}
