/**
 * Events store — manages event state for the Events tab.
 *
 * Processes sync-related library events to maintain a live view of
 * WebSocket events, gap detection/repair, and session boundaries.
 */

import { createMemo, createSignal } from 'solid-js'
import type { SanitizedEvent } from '../../shared/protocol.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PersistenceValue = 'Permanent' | 'Stateful' | 'Anticipated'

const ALL_PERSISTENCE: PersistenceValue[] = ['Permanent', 'Stateful', 'Anticipated']

/** Wire-format event fields after sanitization (BigInt → string). */
export interface SanitizedWsEvent {
  id: string
  type: string
  streamId: string
  data: unknown
  metadata: unknown
  created: string
  revision: string
  position: string
  persistence?: string
}

export interface EventEntry {
  entryId: string
  event: SanitizedWsEvent
  timestamp: number
}

export interface ProcessorResult {
  invalidated: boolean
  updatedIds: string[]
}

interface EventItem {
  kind: 'event'
  entry: EventEntry
}

interface GapDetectedItem {
  kind: 'gap-detected'
  streamId: string
  expected: string
  received: string
  timestamp: number
}

interface GapRepairStartedItem {
  kind: 'gap-repair-started'
  streamId: string
  fromRevision: string
  timestamp: number
}

interface GapRepairCompletedItem {
  kind: 'gap-repair-completed'
  streamId: string
  eventCount: number
  timestamp: number
}

interface SessionDividerItem {
  kind: 'session-divider'
  userId: string
  timestamp: number
}

export type EventListItem =
  | EventItem
  | GapDetectedItem
  | GapRepairStartedItem
  | GapRepairCompletedItem
  | SessionDividerItem

export interface EventsStore {
  allItems: () => EventListItem[]
  filteredItems: () => EventListItem[]
  persistenceFilter: () => Set<PersistenceValue>
  togglePersistenceFilter: (value: PersistenceValue) => void
  selectAllPersistence: () => void
  clearPersistence: () => void
  typeFilter: () => Set<string>
  toggleTypeFilter: (type: string) => void
  selectAllTypes: () => void
  clearTypeFilter: () => void
  streamFilter: () => string
  setStreamFilter: (value: string) => void
  filterVersion: () => number
  seenEventTypes: () => string[]
  seenStreamIds: () => string[]
  selectedId: () => string | undefined
  selectEvent: (id: string | undefined) => void
  selectedEntry: () => EventEntry | undefined
  getProcessorResult: (eventId: string) => ProcessorResult | undefined
  handleEvent: (event: SanitizedEvent) => void
  clear: () => void
  exportJson: () => string
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let nextEntryId = 0

export function createEventsStore(): EventsStore {
  const [allItems, setAllItems] = createSignal<EventListItem[]>([])
  const [processorResults, setProcessorResults] = createSignal<Map<string, ProcessorResult>>(
    new Map(),
  )
  const [seenEventTypes, setSeenEventTypes] = createSignal<Set<string>>(new Set())
  const [seenStreamIds, setSeenStreamIds] = createSignal<Set<string>>(new Set())

  const [persistenceFilter, setPersistenceFilter] = createSignal<Set<PersistenceValue>>(
    new Set(ALL_PERSISTENCE),
  )
  const [typeFilter, setTypeFilter] = createSignal<Set<string>>(new Set())
  const [streamFilter, setStreamFilterRaw] = createSignal('')
  const [filterVersion, setFilterVersion] = createSignal(0)

  const [selectedId, setSelectedId] = createSignal<string | undefined>()

  // --- Derived ---

  function bumpFilterVersion(): void {
    setFilterVersion((v) => v + 1)
  }

  const filteredItems = createMemo(() => {
    const items = allItems()
    const persistence = persistenceFilter()
    const typeF = typeFilter()
    const streamF = streamFilter()

    return items.filter((item) => {
      if (item.kind === 'event') {
        const wsEvent = item.entry.event
        const eventPersistence = normalizePersistence(wsEvent.persistence)
        if (!persistence.has(eventPersistence)) return false
        if (typeF.size > 0 && !typeF.has(wsEvent.type)) return false
        if (streamF && !wsEvent.streamId.includes(streamF)) return false
        return true
      }

      // Gap banners: filter by stream when stream filter is active
      if (
        item.kind === 'gap-detected' ||
        item.kind === 'gap-repair-started' ||
        item.kind === 'gap-repair-completed'
      ) {
        if (streamF && !item.streamId.includes(streamF)) return false
        return true
      }

      // Session dividers always show
      return true
    })
  })

  // Build entry lookup from allItems for selection
  function findEntry(entryId: string): EventEntry | undefined {
    const items = allItems()
    for (const item of items) {
      if (item.kind === 'event' && item.entry.entryId === entryId) {
        return item.entry
      }
    }
    return undefined
  }

  // --- Event handling ---

  function handleEvent(event: SanitizedEvent): void {
    switch (event.type) {
      case 'sync:ws-event-received': {
        const wsEvent = event.data['event'] as SanitizedWsEvent | undefined
        if (!wsEvent) return

        const entryId = `evt-${nextEntryId++}`
        const entry: EventEntry = { entryId, event: wsEvent, timestamp: event.timestamp }
        const item: EventItem = { kind: 'event', entry }

        setAllItems((prev) => [...prev, item])

        // Track seen types and streams
        setSeenEventTypes((prev) => {
          if (prev.has(wsEvent.type)) return prev
          const next = new Set(prev)
          next.add(wsEvent.type)
          return next
        })
        setSeenStreamIds((prev) => {
          if (prev.has(wsEvent.streamId)) return prev
          const next = new Set(prev)
          next.add(wsEvent.streamId)
          return next
        })
        break
      }

      case 'sync:ws-event-processed': {
        const wsEvent = event.data['event'] as SanitizedWsEvent | undefined
        if (!wsEvent) return

        const result: ProcessorResult = {
          invalidated: (event.data['invalidated'] as boolean) ?? false,
          updatedIds: (event.data['updatedIds'] as string[]) ?? [],
        }

        setProcessorResults((prev) => {
          const next = new Map(prev)
          next.set(wsEvent.id, result)
          return next
        })
        break
      }

      case 'sync:gap-detected': {
        const item: GapDetectedItem = {
          kind: 'gap-detected',
          streamId: (event.data['streamId'] as string) ?? '',
          expected: String(event.data['expected'] ?? ''),
          received: String(event.data['received'] ?? ''),
          timestamp: event.timestamp,
        }
        setAllItems((prev) => [...prev, item])
        break
      }

      case 'sync:gap-repair-started': {
        const item: GapRepairStartedItem = {
          kind: 'gap-repair-started',
          streamId: (event.data['streamId'] as string) ?? '',
          fromRevision: String(event.data['fromRevision'] ?? ''),
          timestamp: event.timestamp,
        }
        setAllItems((prev) => [...prev, item])
        break
      }

      case 'sync:gap-repair-completed': {
        const item: GapRepairCompletedItem = {
          kind: 'gap-repair-completed',
          streamId: (event.data['streamId'] as string) ?? '',
          eventCount: (event.data['eventCount'] as number) ?? 0,
          timestamp: event.timestamp,
        }
        setAllItems((prev) => [...prev, item])
        break
      }

      case 'session:changed': {
        const item: SessionDividerItem = {
          kind: 'session-divider',
          userId: (event.data['userId'] as string) ?? '',
          timestamp: event.timestamp,
        }
        setAllItems((prev) => [...prev, item])
        break
      }
    }
  }

  function clear(): void {
    setAllItems([])
    setProcessorResults(new Map())
    setSeenEventTypes(new Set<string>())
    setSeenStreamIds(new Set<string>())
    setTypeFilter(new Set<string>())
    setStreamFilterRaw('')
    setSelectedId(undefined)
  }

  function exportJson(): string {
    const items = allItems()
    const results = processorResults()
    const exportData = items.map((item) => {
      if (item.kind === 'event') {
        const result = results.get(item.entry.event.id)
        return { ...item, processorResult: result }
      }
      return item
    })
    return JSON.stringify(exportData, null, 2)
  }

  return {
    allItems,
    filteredItems,
    persistenceFilter,
    togglePersistenceFilter(value) {
      setPersistenceFilter((prev) => {
        const next = new Set(prev)
        if (next.has(value)) {
          next.delete(value)
        } else {
          next.add(value)
        }
        return next
      })
      bumpFilterVersion()
    },
    selectAllPersistence() {
      setPersistenceFilter(new Set(ALL_PERSISTENCE))
      bumpFilterVersion()
    },
    clearPersistence() {
      setPersistenceFilter(new Set<PersistenceValue>())
      bumpFilterVersion()
    },
    typeFilter,
    toggleTypeFilter(type) {
      setTypeFilter((prev) => {
        const next = new Set(prev)
        if (next.has(type)) {
          next.delete(type)
        } else {
          next.add(type)
        }
        return next
      })
      bumpFilterVersion()
    },
    selectAllTypes() {
      setTypeFilter(new Set(seenEventTypes()))
      bumpFilterVersion()
    },
    clearTypeFilter() {
      setTypeFilter(new Set<string>())
      bumpFilterVersion()
    },
    streamFilter,
    setStreamFilter(value) {
      setStreamFilterRaw(value)
      bumpFilterVersion()
    },
    filterVersion,
    seenEventTypes: () => Array.from(seenEventTypes()).sort(),
    seenStreamIds: () => Array.from(seenStreamIds()).sort(),
    selectedId,
    selectEvent: setSelectedId,
    selectedEntry() {
      const id = selectedId()
      if (!id) return undefined
      return findEntry(id)
    },
    getProcessorResult(eventId) {
      return processorResults().get(eventId)
    },
    handleEvent,
    clear,
    exportJson,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePersistence(value: string | undefined): PersistenceValue {
  if (value === 'Stateful') return 'Stateful'
  if (value === 'Anticipated') return 'Anticipated'
  return 'Permanent'
}
