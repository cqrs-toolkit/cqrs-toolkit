/**
 * Commands store — manages command state for the Commands tab.
 *
 * Processes command-related library events and command snapshots
 * to maintain a live view of all commands.
 */

import type { CommandStatus } from '@cqrs-toolkit/client'
import { createSignal } from 'solid-js'
import type { SanitizedEvent, SerializedCommandRecord } from '../../shared/protocol.js'

export interface DebugEvent {
  type: string
  payload: Record<string, unknown>
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
  selectedId: () => string | undefined
  selectCommand: (id: string | undefined) => void
  selectedEntry: () => CommandEntry | undefined
  handleEvent: (event: SanitizedEvent) => void
  setCommands: (commands: SerializedCommandRecord[]) => void
  clear: () => void
}

const ALL_STATUSES: CommandStatus[] = [
  'pending',
  'blocked',
  'sending',
  'succeeded',
  'failed',
  'cancelled',
]

export function createCommandsStore(): CommandsStore {
  const [entries, setEntries] = createSignal<Map<string, CommandEntry>>(new Map())
  const [filterStatuses, setFilterStatuses] = createSignal<Set<CommandStatus>>(
    new Set(ALL_STATUSES),
  )
  const [selectedId, setSelectedId] = createSignal<string | undefined>()

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
    return commands().filter((e) => active.has(e.record.status))
  }

  function handleEvent(event: SanitizedEvent): void {
    const payload = event.payload

    switch (event.type) {
      case 'command:enqueued': {
        const commandId = payload['commandId'] as string | undefined
        if (!commandId) return

        // We might not have the full record yet — create a placeholder
        setEntries((prev) => {
          const next = new Map(prev)
          const existing = next.get(commandId)
          if (!existing) {
            const record: SerializedCommandRecord = {
              commandId,
              service: '',
              type: (payload['type'] as string) ?? '',
              payload: {},
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
        const commandId = payload['commandId'] as string | undefined
        if (!commandId) return
        upsertEntry(commandId, (entry) => ({
          ...entry,
          record: {
            ...entry.record,
            status: (payload['status'] as CommandStatus) ?? entry.record.status,
            updatedAt: event.timestamp,
          },
        }))
        break
      }

      case 'command:completed': {
        const commandId = payload['commandId'] as string | undefined
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
        const commandId = payload['commandId'] as string | undefined
        if (!commandId) return
        upsertEntry(commandId, (entry) => ({
          ...entry,
          record: {
            ...entry.record,
            status: 'failed',
            error: {
              source: 'server',
              message: (payload['error'] as string) ?? 'Unknown error',
            },
            updatedAt: event.timestamp,
          },
        }))
        break
      }

      case 'command:sent': {
        const commandId = payload['commandId'] as string | undefined
        if (!commandId) return

        const debugEvent: DebugEvent = {
          type: event.type,
          payload,
          timestamp: event.timestamp,
        }

        // Also enrich the record if we have a placeholder
        upsertEntry(commandId, (entry) => ({
          record: {
            ...entry.record,
            service: (payload['service'] as string) || entry.record.service,
            type: (payload['type'] as string) || entry.record.type,
            payload: payload['payload'] ?? entry.record.payload,
          },
          debugEvents: [...entry.debugEvents, debugEvent],
        }))
        break
      }

      case 'command:response': {
        const commandId = payload['commandId'] as string | undefined
        if (!commandId) return

        const debugEvent: DebugEvent = {
          type: event.type,
          payload,
          timestamp: event.timestamp,
        }

        upsertEntry(commandId, (entry) => ({
          record: {
            ...entry.record,
            serverResponse: payload['response'],
          },
          debugEvents: [...entry.debugEvents, debugEvent],
        }))
        break
      }
    }
  }

  function setCommands(commands: SerializedCommandRecord[]): void {
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
    },
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
  }
}
