/**
 * Unit tests for EventCache and GapDetector.
 */

import type { IPersistedEvent } from '@meticoeus/ddd-es'
import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { EventBus } from '../events/EventBus.js'
import { EventCache } from './EventCache.js'
import { GapBuffer, detectGaps } from './GapDetector.js'

function createPersistedEvent(overrides: Partial<IPersistedEvent> = {}): IPersistedEvent {
  return {
    id: 'event-1',
    type: 'TestEvent',
    streamId: 'stream-1',
    data: { id: 'stream-1' },
    metadata: { correlationId: 'test' },
    created: new Date().toISOString(),
    revision: BigInt(1),
    position: BigInt(100),
    ...overrides,
  }
}

describe('EventCache', () => {
  let storage: InMemoryStorage
  let eventBus: EventBus
  let eventCache: EventCache

  beforeEach(async () => {
    storage = new InMemoryStorage()
    await storage.initialize()
    eventBus = new EventBus()
    eventCache = new EventCache({ storage, eventBus })
  })

  describe('cacheServerEvent', () => {
    it('caches a permanent event', async () => {
      const event = createPersistedEvent({
        id: 'event-1',
        type: 'TodoCreated',
        streamId: 'todo-1',
        data: { id: 'todo-1', title: 'Test' },
      })

      const cached = await eventCache.cacheServerEvent(event, { cacheKey: 'cache-1' })

      expect(cached).toBe(true)

      const stored = await eventCache.getEvent('event-1')
      expect(stored).toMatchObject({
        id: 'event-1',
        type: 'TodoCreated',
        persistence: 'Permanent',
        position: '100',
        revision: '1',
      })
    })

    it('does not report false gaps when revisions are consecutive but positions are not', async () => {
      const event1 = createPersistedEvent({
        id: 'event-1',
        type: 'NoteCreated',
        streamId: 'note-1',
        data: { id: 'note-1', title: 'First' },
        position: BigInt(5),
        revision: BigInt(1),
      })
      const event2 = createPersistedEvent({
        id: 'event-2',
        type: 'NoteDeleted',
        streamId: 'note-1',
        data: { id: 'note-1', title: 'First' },
        position: BigInt(15),
        revision: BigInt(2),
      })

      await eventCache.cacheServerEvent(event1, { cacheKey: 'cache-1' })
      await eventCache.cacheServerEvent(event2, { cacheKey: 'cache-1' })

      expect(eventCache.hasGaps()).toBe(false)
    })

    it('rejects duplicate events', async () => {
      const event = createPersistedEvent({
        id: 'event-1',
        type: 'TodoCreated',
        streamId: 'todo-1',
        data: { id: 'todo-1', title: 'Test' },
      })

      await eventCache.cacheServerEvent(event, { cacheKey: 'cache-1' })
      const cached = await eventCache.cacheServerEvent(event, { cacheKey: 'cache-1' })

      expect(cached).toBe(false)
    })
  })

  describe('cacheServerEvents', () => {
    it('caches multiple events', async () => {
      const events: IPersistedEvent[] = [
        createPersistedEvent({
          id: 'event-1',
          type: 'TodoCreated',
          streamId: 'todo-1',
          data: { id: 'todo-1', title: 'Test 1' },
          position: BigInt(100),
          revision: BigInt(1),
        }),
        createPersistedEvent({
          id: 'event-2',
          type: 'TodoCreated',
          streamId: 'todo-2',
          data: { id: 'todo-2', title: 'Test 2' },
          position: BigInt(101),
          revision: BigInt(1),
        }),
      ]

      const count = await eventCache.cacheServerEvents(events, { cacheKey: 'cache-1' })

      expect(count).toBe(2)
      expect(await eventCache.getEvent('event-1')).toBeTruthy()
      expect(await eventCache.getEvent('event-2')).toBeTruthy()
    })

    it('skips duplicates in batch', async () => {
      const event = createPersistedEvent({
        id: 'event-1',
        type: 'TodoCreated',
        streamId: 'todo-1',
        data: { id: 'todo-1', title: 'Test' },
      })

      await eventCache.cacheServerEvent(event, { cacheKey: 'cache-1' })

      const count = await eventCache.cacheServerEvents(
        [event, createPersistedEvent({ id: 'event-2', position: BigInt(101) })],
        { cacheKey: 'cache-1' },
      )

      expect(count).toBe(1) // Only event-2 was cached
    })
  })

  describe('cacheAnticipatedEvent', () => {
    it('caches an anticipated event with generated ID', async () => {
      const eventData = {
        type: 'TodoCreated',
        streamId: 'todo-1',
        data: { title: 'Test' },
        commandId: 'cmd-1',
      }

      const id = await eventCache.cacheAnticipatedEvent(eventData, {
        cacheKey: 'cache-1',
        commandId: 'cmd-1',
      })

      expect(id).toBeDefined()

      const stored = await eventCache.getEvent(id)
      expect(stored).toMatchObject({
        type: 'TodoCreated',
        persistence: 'Anticipated',
        commandId: 'cmd-1',
      })
    })
  })

  describe('cacheAnticipatedEvents', () => {
    it('caches multiple anticipated events', async () => {
      const events = [
        {
          type: 'TodoCreated',
          streamId: 'todo-1',
          data: { title: 'Test 1' } as Record<string, unknown>,
          commandId: 'cmd-1',
        },
        {
          type: 'TodoUpdated',
          streamId: 'todo-1',
          data: { done: true } as Record<string, unknown>,
          commandId: 'cmd-1',
        },
      ]

      const ids = await eventCache.cacheAnticipatedEvents(events, {
        cacheKey: 'cache-1',
        commandId: 'cmd-1',
      })

      expect(ids).toHaveLength(2)
      expect(await eventCache.getEvent(ids[0]!)).toBeTruthy()
      expect(await eventCache.getEvent(ids[1]!)).toBeTruthy()
    })
  })

  describe('getEventsByCacheKey', () => {
    it('returns events for a cache key', async () => {
      const event1 = createPersistedEvent({
        id: 'event-1',
        type: 'Event1',
        position: BigInt(1),
        revision: BigInt(1),
      })
      const event2 = createPersistedEvent({
        id: 'event-2',
        type: 'Event2',
        position: BigInt(2),
        revision: BigInt(2),
      })

      await eventCache.cacheServerEvent(event1, { cacheKey: 'cache-1' })
      await eventCache.cacheServerEvent(event2, { cacheKey: 'cache-2' })

      const events = await eventCache.getEventsByCacheKey('cache-1')
      expect(events).toHaveLength(1)
      expect(events[0]?.id).toBe('event-1')
    })
  })

  describe('getEventsByStream', () => {
    it('returns events sorted by position', async () => {
      const events: IPersistedEvent[] = [
        createPersistedEvent({
          id: 'event-3',
          position: BigInt(300),
          revision: BigInt(3),
        }),
        createPersistedEvent({
          id: 'event-1',
          position: BigInt(100),
          revision: BigInt(1),
        }),
        createPersistedEvent({
          id: 'event-2',
          position: BigInt(200),
          revision: BigInt(2),
        }),
      ]

      for (const event of events) {
        await eventCache.cacheServerEvent(event, { cacheKey: 'cache-1' })
      }

      const sorted = await eventCache.getEventsByStream('stream-1')
      expect(sorted.map((e) => e.id)).toEqual(['event-1', 'event-2', 'event-3'])
    })
  })

  describe('getAnticipatedEventsByCommand', () => {
    it('returns anticipated events for a command', async () => {
      await eventCache.cacheAnticipatedEvent(
        { type: 'Event1', streamId: 'stream-1', data: {}, commandId: 'cmd-1' },
        { cacheKey: 'cache-1', commandId: 'cmd-1' },
      )
      await eventCache.cacheAnticipatedEvent(
        { type: 'Event2', streamId: 'stream-1', data: {}, commandId: 'cmd-2' },
        { cacheKey: 'cache-1', commandId: 'cmd-2' },
      )

      const events = await eventCache.getAnticipatedEventsByCommand('cmd-1')
      expect(events).toHaveLength(1)
      expect(events[0]?.type).toBe('Event1')
    })
  })

  describe('deleteAnticipatedEvents', () => {
    it('deletes anticipated events for a command', async () => {
      const id = await eventCache.cacheAnticipatedEvent(
        { type: 'Event1', streamId: 'stream-1', data: {}, commandId: 'cmd-1' },
        { cacheKey: 'cache-1', commandId: 'cmd-1' },
      )

      await eventCache.deleteAnticipatedEvents('cmd-1')

      expect(await eventCache.getEvent(id)).toBeNull()
    })
  })

  describe('replaceAnticipatedWithConfirmed', () => {
    it('replaces anticipated events with confirmed', async () => {
      const anticipatedId = await eventCache.cacheAnticipatedEvent(
        { type: 'TodoCreated', streamId: 'todo-1', data: { title: 'Test' }, commandId: 'cmd-1' },
        { cacheKey: 'cache-1', commandId: 'cmd-1' },
      )

      const confirmedEvent = createPersistedEvent({
        id: 'event-confirmed',
        type: 'TodoCreated',
        streamId: 'todo-1',
        data: { id: 'todo-1', title: 'Test' },
      })

      await eventCache.replaceAnticipatedWithConfirmed('cmd-1', [confirmedEvent], 'cache-1')

      expect(await eventCache.getEvent(anticipatedId)).toBeNull()
      expect(await eventCache.getEvent('event-confirmed')).toBeTruthy()
    })
  })
})

describe('GapDetector', () => {
  describe('detectGaps', () => {
    it('detects no gaps in contiguous sequence', () => {
      const positions = [BigInt(1), BigInt(2), BigInt(3), BigInt(4)]
      const result = detectGaps(positions)

      expect(result.hasGaps).toBe(false)
      expect(result.gaps).toHaveLength(0)
      expect(result.highestPosition).toBe(BigInt(4))
    })

    it('detects internal gap', () => {
      const positions = [BigInt(1), BigInt(2), BigInt(5), BigInt(6)]
      const result = detectGaps(positions)

      expect(result.hasGaps).toBe(true)
      expect(result.gaps).toHaveLength(1)
      expect(result.gaps[0]).toEqual({
        fromPosition: BigInt(2),
        toPosition: BigInt(5),
      })
    })

    it('detects multiple gaps', () => {
      const positions = [BigInt(1), BigInt(5), BigInt(10)]
      const result = detectGaps(positions)

      expect(result.hasGaps).toBe(true)
      expect(result.gaps).toHaveLength(2)
    })

    it('detects leading gap with known highest', () => {
      const positions = [BigInt(5), BigInt(6)]
      const result = detectGaps(positions, BigInt(2))

      expect(result.hasGaps).toBe(true)
      expect(result.gaps).toHaveLength(1)
      expect(result.gaps[0]).toEqual({
        fromPosition: BigInt(2),
        toPosition: BigInt(5),
      })
    })

    it('handles unsorted input', () => {
      const positions = [BigInt(5), BigInt(2), BigInt(3), BigInt(1)]
      const result = detectGaps(positions)

      expect(result.hasGaps).toBe(true) // Gap between 3 and 5
      expect(result.gaps).toHaveLength(1)
      expect(result.highestPosition).toBe(BigInt(5))
    })

    it('handles empty input', () => {
      const result = detectGaps([])

      expect(result.hasGaps).toBe(false)
      expect(result.gaps).toHaveLength(0)
      expect(result.highestPosition).toBe(BigInt(0))
    })

    it('handles empty input with known highest', () => {
      const result = detectGaps([], BigInt(10))

      expect(result.hasGaps).toBe(false)
      expect(result.highestPosition).toBe(BigInt(10))
    })
  })
})

describe('GapBuffer', () => {
  let buffer: GapBuffer

  beforeEach(() => {
    buffer = new GapBuffer()
  })

  describe('add', () => {
    it('adds events to buffer', () => {
      buffer.add('stream-1', BigInt(1), { data: 1 })
      buffer.add('stream-1', BigInt(2), { data: 2 })

      const events = buffer.getEvents('stream-1')
      expect(events).toHaveLength(2)
    })

    it('returns true when gap is detected', () => {
      buffer.add('stream-1', BigInt(1), { data: 1 })
      const hasGap = buffer.add('stream-1', BigInt(5), { data: 5 })

      expect(hasGap).toBe(true)
    })

    it('returns false when no gap', () => {
      buffer.add('stream-1', BigInt(1), { data: 1 })
      const hasGap = buffer.add('stream-1', BigInt(2), { data: 2 })

      expect(hasGap).toBe(false)
    })
  })

  describe('getEvents', () => {
    it('returns events sorted by position', () => {
      buffer.add('stream-1', BigInt(3), { data: 3 })
      buffer.add('stream-1', BigInt(1), { data: 1 })
      buffer.add('stream-1', BigInt(2), { data: 2 })

      const events = buffer.getEvents('stream-1')
      expect(events.map((e) => e.position)).toEqual([BigInt(1), BigInt(2), BigInt(3)])
    })

    it('returns empty array for unknown stream', () => {
      const events = buffer.getEvents('unknown')
      expect(events).toHaveLength(0)
    })
  })

  describe('clearUpTo', () => {
    it('clears events up to position', () => {
      buffer.add('stream-1', BigInt(1), { data: 1 })
      buffer.add('stream-1', BigInt(2), { data: 2 })
      buffer.add('stream-1', BigInt(3), { data: 3 })

      buffer.clearUpTo('stream-1', BigInt(2))

      const events = buffer.getEvents('stream-1')
      expect(events).toHaveLength(1)
      expect(events[0]?.position).toBe(BigInt(3))
    })
  })

  describe('getGaps', () => {
    it('returns gaps for all streams', () => {
      buffer.add('stream-1', BigInt(1), { data: 1 })
      buffer.add('stream-1', BigInt(5), { data: 5 })

      buffer.add('stream-2', BigInt(1), { data: 1 })
      buffer.add('stream-2', BigInt(2), { data: 2 })

      const gaps = buffer.getGaps()

      expect(gaps.has('stream-1')).toBe(true)
      expect(gaps.get('stream-1')!.length).toBe(1)
      expect(gaps.has('stream-2')).toBe(false) // No gaps
    })
  })

  describe('setKnownPosition', () => {
    it('uses known position for gap detection', () => {
      buffer.setKnownPosition('stream-1', BigInt(5))
      const hasGap = buffer.add('stream-1', BigInt(10), { data: 10 })

      expect(hasGap).toBe(true)
    })
  })
})
