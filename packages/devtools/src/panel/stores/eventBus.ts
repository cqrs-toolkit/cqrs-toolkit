/**
 * EventBus store — accumulates every raw library event for the EventBus tab.
 *
 * Unlike other stores that parse events into domain-specific views, this store
 * captures every SanitizedEvent unconditionally as a live diagnostic log.
 */

import { createMemo, createSignal } from 'solid-js'
import type { SanitizedEvent } from '../../shared/protocol.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EventBusEntry {
  entryId: string
  event: SanitizedEvent
}

export interface EventBusStore {
  entries: () => EventBusEntry[]
  filteredEntries: () => EventBusEntry[]

  prefixFilter: () => Set<string>
  togglePrefixFilter: (v: string) => void
  selectAllPrefixes: () => void
  clearPrefixFilter: () => void
  seenPrefixes: () => string[]

  typeFilter: () => Set<string>
  toggleTypeFilter: (v: string) => void
  selectAllTypes: () => void
  clearTypeFilter: () => void
  seenTypes: () => string[]

  showDebug: () => boolean
  setShowDebug: (v: boolean) => void

  filterVersion: () => number
  selectedId: () => string | undefined
  selectEntry: (id: string | undefined) => void
  selectedEntry: () => EventBusEntry | undefined
  handleEvent: (event: SanitizedEvent) => void
  clear: () => void
  exportJson: () => string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPrefix(type: string): string {
  const i = type.indexOf(':')
  return i === -1 ? type : type.slice(0, i)
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let nextEntryId = 0

export function createEventBusStore(): EventBusStore {
  const [entries, setEntries] = createSignal<EventBusEntry[]>([])

  const [prefixFilter, setPrefixFilter] = createSignal<Set<string>>(new Set())
  const [seenPrefixes, setSeenPrefixes] = createSignal<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = createSignal<Set<string>>(new Set())
  const [seenTypes, setSeenTypes] = createSignal<Set<string>>(new Set())
  const [showDebug, setShowDebug] = createSignal(true)
  const [filterVersion, setFilterVersion] = createSignal(0)
  const [selectedId, setSelectedId] = createSignal<string | undefined>()

  function bumpFilterVersion(): void {
    setFilterVersion((v) => v + 1)
  }

  const filteredEntries = createMemo(() => {
    const items = entries()
    const prefixes = prefixFilter()
    const types = typeFilter()
    const debug = showDebug()

    if (prefixes.size === 0 && types.size === 0 && debug) return items

    return items.filter((item) => {
      if (!debug && item.event.debug) return false
      if (prefixes.size > 0 && !prefixes.has(getPrefix(item.event.type))) return false
      if (types.size > 0 && !types.has(item.event.type)) return false
      return true
    })
  })

  function handleEvent(event: SanitizedEvent): void {
    const entry: EventBusEntry = {
      entryId: `bus-${nextEntryId++}`,
      event,
    }
    setEntries((prev) => [...prev, entry])

    const prefix = getPrefix(event.type)
    setSeenPrefixes((prev) => {
      if (prev.has(prefix)) return prev
      const next = new Set(prev)
      next.add(prefix)
      return next
    })
    setSeenTypes((prev) => {
      if (prev.has(event.type)) return prev
      const next = new Set(prev)
      next.add(event.type)
      return next
    })
  }

  function clear(): void {
    setEntries([])
    setPrefixFilter(new Set<string>())
    setSeenPrefixes(new Set<string>())
    setTypeFilter(new Set<string>())
    setSeenTypes(new Set<string>())
    setShowDebug(true)
    setSelectedId(undefined)
  }

  return {
    entries,
    filteredEntries,

    prefixFilter,
    togglePrefixFilter(v) {
      setPrefixFilter((prev) => {
        const next = new Set(prev)
        if (next.has(v)) next.delete(v)
        else next.add(v)
        return next
      })
      bumpFilterVersion()
    },
    selectAllPrefixes() {
      setPrefixFilter(new Set(seenPrefixes()))
      bumpFilterVersion()
    },
    clearPrefixFilter() {
      setPrefixFilter(new Set<string>())
      bumpFilterVersion()
    },
    seenPrefixes: () => Array.from(seenPrefixes()).sort(),

    typeFilter,
    toggleTypeFilter(v) {
      setTypeFilter((prev) => {
        const next = new Set(prev)
        if (next.has(v)) next.delete(v)
        else next.add(v)
        return next
      })
      bumpFilterVersion()
    },
    selectAllTypes() {
      setTypeFilter(new Set(seenTypes()))
      bumpFilterVersion()
    },
    clearTypeFilter() {
      setTypeFilter(new Set<string>())
      bumpFilterVersion()
    },
    seenTypes: () => Array.from(seenTypes()).sort(),

    showDebug,
    setShowDebug(v) {
      setShowDebug(v)
      bumpFilterVersion()
    },

    filterVersion,
    selectedId,
    selectEntry: setSelectedId,
    selectedEntry() {
      const id = selectedId()
      if (!id) return undefined
      const items = entries()
      for (const item of items) {
        if (item.entryId === id) return item
      }
      return undefined
    },
    handleEvent,
    clear,
    exportJson() {
      return JSON.stringify(entries(), null, 2)
    },
  }
}
