/**
 * Sync store — manages sync activity state for the Sync tab.
 *
 * Processes connectivity, WebSocket, sync, and session events to maintain
 * a live activity log with status indicators.
 */

import { createMemo, createSignal } from 'solid-js'
import type { SanitizedEvent } from '../../shared/protocol.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncLogEntry {
  entryId: string
  syncType: string
  scope: string
  details: string
  payload: Record<string, unknown>
  timestamp: number
}

interface SyncEventItem {
  kind: 'event'
  entry: SyncLogEntry
}

interface SyncSessionDividerItem {
  kind: 'session-divider'
  userId: string
  timestamp: number
}

export type SyncListItem = SyncEventItem | SyncSessionDividerItem

type WsState = 'disconnected' | 'connecting' | 'connected'

export interface SyncStore {
  allItems: () => SyncListItem[]
  filteredItems: () => SyncListItem[]
  typeFilter: () => string
  setTypeFilter: (v: string) => void
  filterVersion: () => number
  online: () => boolean | undefined
  wsState: () => WsState | undefined
  selectedId: () => string | undefined
  selectEntry: (id: string | undefined) => void
  selectedEntry: () => SyncLogEntry | undefined
  handleEvent: (event: SanitizedEvent) => void
  clear: () => void
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let nextEntryId = 0

export function createSyncStore(): SyncStore {
  const [allItems, setAllItems] = createSignal<SyncListItem[]>([])
  const [online, setOnline] = createSignal<boolean | undefined>()
  const [wsState, setWsState] = createSignal<WsState | undefined>()

  const [typeFilter, setTypeFilterRaw] = createSignal('')
  const [filterVersion, setFilterVersion] = createSignal(0)
  const [selectedId, setSelectedId] = createSignal<string | undefined>()

  function bumpFilterVersion(): void {
    setFilterVersion((v) => v + 1)
  }

  const filteredItems = createMemo(() => {
    const items = allItems()
    const filter = typeFilter().toLowerCase()

    if (!filter) return items
    return items.filter((item) => {
      if (item.kind === 'session-divider') return true
      return item.entry.syncType.toLowerCase().includes(filter)
    })
  })

  function appendEntry(
    syncType: string,
    scope: string,
    details: string,
    event: SanitizedEvent,
  ): void {
    const entry: SyncLogEntry = {
      entryId: `sync-${nextEntryId++}`,
      syncType,
      scope,
      details,
      payload: event.payload,
      timestamp: event.timestamp,
    }
    const item: SyncEventItem = { kind: 'event', entry }
    setAllItems((prev) => [...prev, item])
  }

  function handleEvent(event: SanitizedEvent): void {
    switch (event.type) {
      case 'connectivity:changed': {
        const isOnline = (event.payload['online'] as boolean) ?? false
        setOnline(isOnline)
        appendEntry('connectivity-changed', 'system', isOnline ? 'Online' : 'Offline', event)
        break
      }

      case 'ws:connecting':
        setWsState('connecting')
        appendEntry('ws-connecting', 'system', 'Connecting...', event)
        break

      case 'ws:connected':
        setWsState('connected')
        appendEntry('ws-connected', 'system', 'Connected', event)
        break

      case 'ws:subscribed': {
        const topics = (event.payload['topics'] as unknown[]) ?? []
        appendEntry('ws-subscribed', 'system', `${topics.length} topics`, event)
        break
      }

      case 'ws:disconnected':
        setWsState('disconnected')
        appendEntry('ws-disconnected', 'system', 'Disconnected', event)
        break

      case 'sync:started': {
        const collection = (event.payload['collection'] as string) ?? ''
        appendEntry('sync-started', collection, 'Sync started', event)
        break
      }

      case 'sync:completed': {
        const collection = (event.payload['collection'] as string) ?? ''
        const eventCount = (event.payload['eventCount'] as number) ?? 0
        appendEntry('sync-completed', collection, `${eventCount} events`, event)
        break
      }

      case 'sync:failed': {
        const collection = (event.payload['collection'] as string) ?? ''
        const error = (event.payload['error'] as string) ?? 'Unknown error'
        appendEntry('sync-failed', collection, error, event)
        break
      }

      case 'sync:seed-completed': {
        const collection = (event.payload['collection'] as string) ?? ''
        const recordCount = (event.payload['recordCount'] as number) ?? 0
        appendEntry('sync-seed-completed', collection, `${recordCount} records seeded`, event)
        break
      }

      case 'sync:refetch-scheduled': {
        const collection = (event.payload['collection'] as string) ?? ''
        const debounceMs = (event.payload['debounceMs'] as number) ?? 0
        appendEntry('sync-refetch-scheduled', collection, `Refetch in ${debounceMs}ms`, event)
        break
      }

      case 'sync:refetch-executed': {
        const collection = (event.payload['collection'] as string) ?? ''
        const recordCount = (event.payload['recordCount'] as number) ?? 0
        appendEntry('sync-refetch-executed', collection, `${recordCount} records`, event)
        break
      }

      case 'session:changed': {
        const userId = (event.payload['userId'] as string) ?? ''
        const item: SyncSessionDividerItem = {
          kind: 'session-divider',
          userId,
          timestamp: event.timestamp,
        }
        setAllItems((prev) => [...prev, item])
        break
      }
    }
  }

  function clear(): void {
    setAllItems([])
    setOnline(undefined)
    setWsState(undefined)
    setSelectedId(undefined)
  }

  return {
    allItems,
    filteredItems,
    typeFilter,
    setTypeFilter(v) {
      setTypeFilterRaw(v)
      bumpFilterVersion()
    },
    filterVersion,
    online,
    wsState,
    selectedId,
    selectEntry: setSelectedId,
    selectedEntry() {
      const id = selectedId()
      if (!id) return undefined
      const items = allItems()
      for (const item of items) {
        if (item.kind === 'event' && item.entry.entryId === id) {
          return item.entry
        }
      }
      return undefined
    },
    handleEvent,
    clear,
  }
}
