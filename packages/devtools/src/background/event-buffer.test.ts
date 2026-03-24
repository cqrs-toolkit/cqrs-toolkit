import { describe, expect, it } from 'vitest'
import type { SanitizedEvent, SerializedConfig } from '../shared/protocol.js'
import { EventBuffer } from './event-buffer.js'

function makeEvent(type: string, timestamp = Date.now()): SanitizedEvent {
  return { type, data: {}, timestamp }
}

const FAKE_CONFIG: SerializedConfig = {
  debug: true,
  retainTerminal: false,
  network: { baseUrl: 'http://localhost:3000' },
  storage: { dbName: 'test' },
  retry: { maxAttempts: 3 },
  cache: { maxCacheKeys: 100 },
  collections: ['todos'],
}

describe('EventBuffer', () => {
  it('stores and retrieves events by tabId', () => {
    const buf = new EventBuffer()
    const event = makeEvent('command:enqueued')

    buf.addEvent(1, event)

    const tab = buf.get(1)
    expect(tab?.events).toHaveLength(1)
    expect(tab?.events[0]).toBe(event)
  })

  it('stores config and role', () => {
    const buf = new EventBuffer()
    buf.setConfig(1, FAKE_CONFIG, 'leader')

    const tab = buf.get(1)
    expect(tab?.config).toBe(FAKE_CONFIG)
    expect(tab?.role).toBe('leader')
  })

  it('stores commands', () => {
    const buf = new EventBuffer()
    const commands = [{ commandId: 'abc', status: 'pending' }]
    buf.setCommands(1, commands as never)

    const tab = buf.get(1)
    expect(tab?.commands).toBe(commands)
  })

  it('clears events on session:changed', () => {
    const buf = new EventBuffer()
    buf.addEvent(1, makeEvent('command:enqueued'))
    buf.addEvent(1, makeEvent('command:completed'))
    expect(buf.get(1)?.events).toHaveLength(2)

    buf.addEvent(1, makeEvent('session:changed'))

    // Only the session:changed event remains
    expect(buf.get(1)?.events).toHaveLength(1)
    expect(buf.get(1)?.events[0]?.type).toBe('session:changed')
  })

  it('clears events on session:destroyed', () => {
    const buf = new EventBuffer()
    buf.addEvent(1, makeEvent('command:enqueued'))

    buf.addEvent(1, makeEvent('session:destroyed'))

    expect(buf.get(1)?.events).toHaveLength(1)
    expect(buf.get(1)?.events[0]?.type).toBe('session:destroyed')
  })

  it('caps buffer at max size', () => {
    const buf = new EventBuffer()
    for (let i = 0; i < 5100; i++) {
      buf.addEvent(1, makeEvent(`event-${i}`))
    }

    expect(buf.get(1)?.events).toHaveLength(5000)
    // Should keep the most recent events
    expect(buf.get(1)?.events[0]?.type).toBe('event-100')
  })

  it('clears events and commands for a tab', () => {
    const buf = new EventBuffer()
    buf.addEvent(1, makeEvent('test'))
    buf.setCommands(1, [{ commandId: 'a' }] as never)
    buf.setConfig(1, FAKE_CONFIG, 'leader')

    buf.clear(1)

    const tab = buf.get(1)
    expect(tab?.events).toHaveLength(0)
    expect(tab?.commands).toHaveLength(0)
    // Config persists through clear
    expect(tab?.config).toBe(FAKE_CONFIG)
  })

  it('deletes entire tab buffer', () => {
    const buf = new EventBuffer()
    buf.addEvent(1, makeEvent('test'))

    buf.delete(1)

    expect(buf.get(1)).toBeUndefined()
  })

  it('isolates tabs from each other', () => {
    const buf = new EventBuffer()
    buf.addEvent(1, makeEvent('tab-1-event'))
    buf.addEvent(2, makeEvent('tab-2-event'))

    expect(buf.get(1)?.events).toHaveLength(1)
    expect(buf.get(2)?.events).toHaveLength(1)
    expect(buf.get(1)?.events[0]?.type).toBe('tab-1-event')
    expect(buf.get(2)?.events[0]?.type).toBe('tab-2-event')
  })
})
