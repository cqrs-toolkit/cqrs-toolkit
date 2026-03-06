/**
 * Per-tab event buffer for the background service worker.
 *
 * Stores events in JS memory (not chrome.storage) so they survive
 * panel close/reopen but not extension restart.
 */

import type {
  SanitizedEvent,
  SerializedCommandRecord,
  SerializedConfig,
} from '../shared/protocol.js'

const MAX_EVENTS = 5000

export interface TabBuffer {
  config: SerializedConfig | undefined
  role: 'leader' | 'standby' | undefined
  events: SanitizedEvent[]
  commands: SerializedCommandRecord[]
}

export class EventBuffer {
  private readonly buffers = new Map<number, TabBuffer>()

  getOrCreate(tabId: number): TabBuffer {
    let buffer = this.buffers.get(tabId)
    if (!buffer) {
      buffer = { config: undefined, role: undefined, events: [], commands: [] }
      this.buffers.set(tabId, buffer)
    }
    return buffer
  }

  addEvent(tabId: number, event: SanitizedEvent): void {
    const buffer = this.getOrCreate(tabId)

    // On session boundary, clear prior events
    if (event.type === 'session:changed' || event.type === 'session:destroyed') {
      buffer.events = []
    }

    buffer.events.push(event)

    // Cap buffer size
    if (buffer.events.length > MAX_EVENTS) {
      buffer.events = buffer.events.slice(buffer.events.length - MAX_EVENTS)
    }
  }

  setConfig(tabId: number, config: SerializedConfig, role: 'leader' | 'standby'): void {
    const buffer = this.getOrCreate(tabId)
    buffer.config = config
    buffer.role = role
  }

  setCommands(tabId: number, commands: SerializedCommandRecord[]): void {
    const buffer = this.getOrCreate(tabId)
    buffer.commands = commands
  }

  get(tabId: number): TabBuffer | undefined {
    return this.buffers.get(tabId)
  }

  clear(tabId: number): void {
    const buffer = this.buffers.get(tabId)
    if (buffer) {
      buffer.events = []
      buffer.commands = []
    }
  }

  delete(tabId: number): void {
    this.buffers.delete(tabId)
  }
}
