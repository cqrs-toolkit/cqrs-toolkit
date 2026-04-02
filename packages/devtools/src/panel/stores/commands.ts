/**
 * Commands store — manages command state for the Commands tab.
 *
 * Processes command-related library events and command snapshots
 * to maintain a live view of all commands.
 */

import type { CommandStatus } from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { createSignal } from 'solid-js'
import type { SanitizedEvent, SerializedCommandRecord } from '../../shared/protocol.js'

export interface DebugEvent {
  type: string
  data: Record<string, unknown>
  timestamp: number
}

interface CommandEntry {
  record: SerializedCommandRecord
  debugEvents: DebugEvent[]
}

export interface CommandsStore {
  commands: () => CommandEntry[]
  filteredCommands: () => CommandEntry[]
  filterStatuses: () => Set<CommandStatus>
  toggleFilter: (status: CommandStatus) => void
  selectAllStatuses: () => void
  clearStatuses: () => void
  seenTypes: () => string[]
  seenServices: () => string[]
  typeFilter: () => Set<string>
  serviceFilter: () => Set<string>
  toggleTypeFilter: (type: string) => void
  selectAllTypes: () => void
  clearTypeFilter: () => void
  toggleServiceFilter: (service: string) => void
  selectAllServices: () => void
  clearServiceFilter: () => void
  filterVersion: () => number
  selectedId: () => string | undefined
  selectCommand: (id: string | undefined) => void
  selectedEntry: () => CommandEntry | undefined
  handleEvent: (event: SanitizedEvent) => void
  setCommands: (commands: SerializedCommandRecord[]) => void
  clear: () => void
  exportJson: () => string
}

const ALL_STATUSES: CommandStatus[] = [
  'pending',
  'blocked',
  'sending',
  'succeeded',
  'failed',
  'cancelled',
]

export function createCommandsStore<TLink extends Link>(): CommandsStore {
  const [entries, setEntries] = createSignal<Map<string, CommandEntry>>(new Map())
  const [filterStatuses, setFilterStatuses] = createSignal<Set<CommandStatus>>(
    new Set(ALL_STATUSES),
  )
  const [seenTypes, setSeenTypes] = createSignal<Set<string>>(new Set())
  const [seenServices, setSeenServices] = createSignal<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = createSignal<Set<string>>(new Set())
  const [serviceFilter, setServiceFilter] = createSignal<Set<string>>(new Set())
  const [selectedId, setSelectedId] = createSignal<string | undefined>()
  const [filterVersion, setFilterVersion] = createSignal(0)

  function bumpFilterVersion(): void {
    setFilterVersion((v) => v + 1)
  }

  function trackType(type: string): void {
    if (type && !seenTypes().has(type)) {
      setSeenTypes((prev) => new Set(prev).add(type))
    }
  }

  function trackService(service: string): void {
    if (service && !seenServices().has(service)) {
      setSeenServices((prev) => new Set(prev).add(service))
    }
  }

  function getEntry(commandId: string): CommandEntry | undefined {
    return entries().get(commandId)
  }

  function upsertEntry(commandId: string, updater: (entry: CommandEntry) => CommandEntry): void {
    setEntries((prev) => {
      const next = new Map(prev)
      const existing = next.get(commandId)
      if (existing) {
        next.set(commandId, updater(existing))
      }
      return next
    })
  }

  function commands(): CommandEntry[] {
    return Array.from(entries().values())
  }

  function filteredCommands(): CommandEntry[] {
    const active = filterStatuses()
    const types = typeFilter()
    const services = serviceFilter()
    return commands().filter((e) => {
      if (!active.has(e.record.status)) return false
      if (types.size > 0 && !types.has(e.record.type)) return false
      if (services.size > 0 && !services.has(e.record.service)) return false
      return true
    })
  }

  function handleEvent(event: SanitizedEvent): void {
    const data = event.data

    switch (event.type) {
      case 'command:enqueued': {
        const commandId = data['commandId'] as string | undefined
        if (!commandId) return

        const type = (data['type'] as string) ?? ''
        if (type) trackType(type)

        // We might not have the full record yet — create a placeholder
        setEntries((prev) => {
          const next = new Map(prev)
          const existing = next.get(commandId)
          if (!existing) {
            const record: SerializedCommandRecord = {
              commandId,
              cacheKey: { kind: 'scope', key: '', scopeType: '' },
              service: '',
              type,
              data: {},
              status: 'pending',
              dependsOn: [],
              blockedBy: [],
              attempts: 0,
              createdAt: event.timestamp,
              updatedAt: event.timestamp,
            }
            next.set(commandId, { record, debugEvents: [] })
          }
          return next
        })
        break
      }

      case 'command:status-changed': {
        const commandId = data['commandId'] as string | undefined
        if (!commandId) return
        upsertEntry(commandId, (entry) => ({
          ...entry,
          record: {
            ...entry.record,
            status: (data['status'] as CommandStatus) ?? entry.record.status,
            updatedAt: event.timestamp,
          },
        }))
        break
      }

      case 'command:completed': {
        const commandId = data['commandId'] as string | undefined
        if (!commandId) return
        upsertEntry(commandId, (entry) => ({
          ...entry,
          record: {
            ...entry.record,
            status: 'succeeded',
            updatedAt: event.timestamp,
          },
        }))
        break
      }

      case 'command:failed': {
        const commandId = data['commandId'] as string | undefined
        if (!commandId) return
        upsertEntry(commandId, (entry) => ({
          ...entry,
          record: {
            ...entry.record,
            status: 'failed',
            error: {
              name: 'CommandFailed',
              message: (data['error'] as string) ?? 'Unknown error',
            },
            updatedAt: event.timestamp,
          },
        }))
        break
      }

      case 'command:sent': {
        const commandId = data['commandId'] as string | undefined
        if (!commandId) return

        const sentType = (data['type'] as string) || ''
        const sentService = (data['service'] as string) || ''
        if (sentType) trackType(sentType)
        if (sentService) trackService(sentService)

        const debugEvent: DebugEvent = {
          type: event.type,
          data,
          timestamp: event.timestamp,
        }

        // Also enrich the record if we have a placeholder
        upsertEntry(commandId, (entry) => ({
          record: {
            ...entry.record,
            service: sentService || entry.record.service,
            type: sentType || entry.record.type,
            data: data['data'] ?? entry.record.data,
          },
          debugEvents: [...entry.debugEvents, debugEvent],
        }))
        break
      }

      case 'command:response': {
        const commandId = data['commandId'] as string | undefined
        if (!commandId) return

        const debugEvent: DebugEvent = {
          type: event.type,
          data,
          timestamp: event.timestamp,
        }

        upsertEntry(commandId, (entry) => ({
          record: {
            ...entry.record,
            serverResponse: data['response'],
          },
          debugEvents: [...entry.debugEvents, debugEvent],
        }))
        break
      }
    }
  }

  function setCommands(commands: SerializedCommandRecord[]): void {
    for (const cmd of commands) {
      if (cmd.type) trackType(cmd.type)
      if (cmd.service) trackService(cmd.service)
    }

    setEntries((prev) => {
      const next = new Map(prev)
      for (const cmd of commands) {
        const existing = next.get(cmd.commandId)
        next.set(cmd.commandId, {
          record: cmd,
          debugEvents: existing?.debugEvents ?? [],
        })
      }
      return next
    })
  }

  function clear(): void {
    setEntries(new Map())
    setSelectedId(undefined)
    setSeenTypes(new Set<string>())
    setSeenServices(new Set<string>())
    setTypeFilter(new Set<string>())
    setServiceFilter(new Set<string>())
  }

  return {
    commands,
    filteredCommands,
    filterStatuses,
    toggleFilter(status) {
      setFilterStatuses((prev) => {
        const next = new Set(prev)
        if (next.has(status)) {
          next.delete(status)
        } else {
          next.add(status)
        }
        return next
      })
      bumpFilterVersion()
    },
    selectAllStatuses() {
      setFilterStatuses(new Set(ALL_STATUSES))
      bumpFilterVersion()
    },
    clearStatuses() {
      setFilterStatuses(new Set<CommandStatus>())
      bumpFilterVersion()
    },
    seenTypes: () => Array.from(seenTypes()).sort(),
    seenServices: () => Array.from(seenServices()).sort(),
    typeFilter,
    serviceFilter,
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
      setTypeFilter(new Set(seenTypes()))
      bumpFilterVersion()
    },
    clearTypeFilter() {
      setTypeFilter(new Set<string>())
      bumpFilterVersion()
    },
    toggleServiceFilter(service) {
      setServiceFilter((prev) => {
        const next = new Set(prev)
        if (next.has(service)) {
          next.delete(service)
        } else {
          next.add(service)
        }
        return next
      })
      bumpFilterVersion()
    },
    selectAllServices() {
      setServiceFilter(new Set(seenServices()))
      bumpFilterVersion()
    },
    clearServiceFilter() {
      setServiceFilter(new Set<string>())
      bumpFilterVersion()
    },
    filterVersion,
    selectedId,
    selectCommand: setSelectedId,
    selectedEntry() {
      const id = selectedId()
      if (!id) return undefined
      return getEntry(id)
    },
    handleEvent,
    setCommands,
    clear,
    exportJson() {
      return JSON.stringify(commands(), null, 2)
    },
  }
}
