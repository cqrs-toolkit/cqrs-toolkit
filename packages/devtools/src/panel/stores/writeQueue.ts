/**
 * Write queue store — manages write queue operation state for the Write Queue tab.
 *
 * Processes writequeue:* debug events to maintain a live list of queue operations
 * with their lifecycle status (pending → processing → completed/error/discarded).
 */

import { createMemo, createSignal } from 'solid-js'
import type { SanitizedEvent } from '../../shared/protocol.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WriteQueueOpStatus = 'pending' | 'processing' | 'completed' | 'error' | 'discarded'

export interface WriteQueueEntry {
  opId: string
  opType: string
  status: WriteQueueOpStatus
  data: Record<string, unknown>
  enqueuedAt: number
  startedAt?: number
  completedAt?: number
  durationMs?: number
  error?: string
  discardReason?: string
}

export interface WriteQueueStore {
  entries: () => WriteQueueEntry[]
  filteredEntries: () => WriteQueueEntry[]
  handleEvent: (event: SanitizedEvent) => void
  clear: () => void
  exportJson: () => string
  typeFilter: () => Set<string>
  toggleTypeFilter: (v: string) => void
  selectAllTypes: () => void
  clearTypeFilter: () => void
  seenTypes: () => string[]
  statusFilter: () => Set<string>
  toggleStatusFilter: (v: string) => void
  seenStatuses: () => string[]
  filterVersion: () => number
  selectedId: () => string | undefined
  selectEntry: (id: string | undefined) => void
  selectedEntry: () => WriteQueueEntry | undefined
  pendingCount: () => number
  opsPerSecond: () => number | undefined
  resetInProgress: () => boolean
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createWriteQueueStore(): WriteQueueStore {
  const [entries, setEntries] = createSignal<WriteQueueEntry[]>([])
  const [resetInProgress, setResetInProgress] = createSignal(false)

  const [typeFilter, setTypeFilter] = createSignal<Set<string>>(new Set())
  const [seenTypes, setSeenTypes] = createSignal<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = createSignal<Set<string>>(new Set())
  const [filterVersion, setFilterVersion] = createSignal(0)
  const [selectedId, setSelectedId] = createSignal<string | undefined>()

  function bumpFilterVersion(): void {
    setFilterVersion((v) => v + 1)
  }

  function trackType(opType: string): void {
    setSeenTypes((prev) => {
      if (prev.has(opType)) return prev
      const next = new Set(prev)
      next.add(opType)
      return next
    })
  }

  function updateEntry(opId: string, updater: (entry: WriteQueueEntry) => WriteQueueEntry): void {
    setEntries((prev) => prev.map((e) => (e.opId === opId ? updater(e) : e)))
  }

  const filteredEntries = createMemo(() => {
    const items = entries()
    const types = typeFilter()
    const statuses = statusFilter()

    if (types.size === 0 && statuses.size === 0) return items
    return items.filter((entry) => {
      if (types.size > 0 && !types.has(entry.opType)) return false
      if (statuses.size > 0 && !statuses.has(entry.status)) return false
      return true
    })
  })

  const pendingCount = createMemo(() => {
    return entries().filter((e) => e.status === 'pending' || e.status === 'processing').length
  })

  const opsPerSecond = createMemo((): number | undefined => {
    const completed = entries().filter(
      (e) => e.status === 'completed' && typeof e.durationMs === 'number',
    )
    if (completed.length === 0) return undefined
    const recent = completed.slice(-100)
    let totalMs = 0
    for (const entry of recent) {
      totalMs += entry.durationMs!
    }
    const avgMs = totalMs / recent.length
    if (avgMs === 0) return undefined
    return Math.round(1000 / avgMs)
  })

  const seenStatuses = createMemo((): string[] => {
    const statuses = new Set<string>()
    for (const entry of entries()) {
      statuses.add(entry.status)
    }
    return Array.from(statuses).sort()
  })

  function handleEvent(event: SanitizedEvent): void {
    switch (event.type) {
      case 'writequeue:op-enqueued': {
        const opId = event.data['opId'] as string
        const opType = event.data['opType'] as string
        const opData = (event.data['op'] as Record<string, unknown>) ?? {}
        trackType(opType)
        const entry: WriteQueueEntry = {
          opId,
          opType,
          status: 'pending',
          data: opData,
          enqueuedAt: event.timestamp,
        }
        setEntries((prev) => [...prev, entry])
        break
      }

      case 'writequeue:op-started': {
        const opId = event.data['opId'] as string
        updateEntry(opId, (e) => ({
          ...e,
          status: 'processing',
          startedAt: event.timestamp,
        }))
        break
      }

      case 'writequeue:op-completed': {
        const opId = event.data['opId'] as string
        const durationMs = event.data['durationMs'] as number
        updateEntry(opId, (e) => ({
          ...e,
          status: 'completed',
          completedAt: event.timestamp,
          durationMs,
        }))
        break
      }

      case 'writequeue:op-error': {
        const opId = event.data['opId'] as string
        const error = event.data['error'] as string
        updateEntry(opId, (e) => ({
          ...e,
          status: 'error',
          completedAt: event.timestamp,
          error,
        }))
        break
      }

      case 'writequeue:op-discarded': {
        const opId = event.data['opId'] as string
        const reason = event.data['reason'] as string
        updateEntry(opId, (e) => ({
          ...e,
          status: 'discarded',
          completedAt: event.timestamp,
          discardReason: reason,
        }))
        break
      }

      case 'writequeue:reset-started':
        setResetInProgress(true)
        break

      case 'writequeue:reset-completed':
        setResetInProgress(false)
        break
    }
  }

  function clear(): void {
    setEntries((prev) => prev.filter((e) => e.status === 'pending' || e.status === 'processing'))
  }

  return {
    entries,
    filteredEntries,
    handleEvent,
    clear,
    exportJson() {
      return JSON.stringify(entries(), null, 2)
    },
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
    seenStatuses: () => seenStatuses(),
    filterVersion,
    selectedId,
    selectEntry: setSelectedId,
    selectedEntry() {
      const id = selectedId()
      if (!id) return undefined
      return entries().find((e) => e.opId === id)
    },
    pendingCount,
    opsPerSecond,
    resetInProgress,
  }
}
