import type { ServiceLink } from '@meticoeus/ddd-es'
import { describe, expect, it, vi } from 'vitest'
import { TodoAggregate } from '../../testing/index.js'
import type { Collection, FetchContext } from '../../types/config.js'
import type { ICacheManagerInternal } from '../cache-manager/types.js'
import { EventBus } from '../events/EventBus.js'
import { InvalidationScheduler } from './InvalidationScheduler.js'
import { SeedStatusIndex } from './SeedStatusIndex.js'

const COLLECTIONS: Collection<ServiceLink>[] = [
  {
    name: 'todos',
    aggregate: TodoAggregate,
    matchesStream: (s) => s.startsWith('nb.Todo-'),
    cacheKeysFromTopics: () => [],
  },
  {
    name: 'notes',
    aggregate: TodoAggregate,
    matchesStream: (s) => s.startsWith('nb.Note-'),
    cacheKeysFromTopics: () => [],
  },
]

function makeScheduler(): InvalidationScheduler<ServiceLink> {
  const eventBus = new EventBus<ServiceLink>()
  const cacheManager = {} as unknown as ICacheManagerInternal<ServiceLink>
  const seedStatus = new SeedStatusIndex()
  return new InvalidationScheduler<ServiceLink>(eventBus, cacheManager, seedStatus, COLLECTIONS, {
    getFetchContext: async () => ({}) as unknown as FetchContext,
    onRefetch: async () => ({ ok: true, value: { seeded: false, recordCount: 0 } }),
  })
}

describe('InvalidationScheduler.invalidateAggregate', () => {
  it('dispatches to schedule with the resolved collection name and cache key', () => {
    const scheduler = makeScheduler()
    const scheduleSpy = vi.spyOn(scheduler, 'schedule')

    scheduler.invalidateAggregate({
      streamId: 'nb.Todo-todo-1',
      cacheKey: 'scope:todos',
      commandId: 'cmd-1',
      reason: 'event-less-response',
    })

    expect(scheduleSpy).toHaveBeenCalledTimes(1)
    expect(scheduleSpy).toHaveBeenCalledWith('todos', ['scope:todos'])
  })

  it('resolves the collection via matchesStream (not by name)', () => {
    const scheduler = makeScheduler()
    const scheduleSpy = vi.spyOn(scheduler, 'schedule')

    scheduler.invalidateAggregate({
      streamId: 'nb.Note-note-42',
      cacheKey: 'scope:notes',
      commandId: 'cmd-2',
      reason: 'no-expected-revision',
    })

    expect(scheduleSpy).toHaveBeenCalledWith('notes', ['scope:notes'])
  })

  it('drops the invalidation and does not throw when no collection matches', () => {
    const scheduler = makeScheduler()
    const scheduleSpy = vi.spyOn(scheduler, 'schedule')

    expect(() =>
      scheduler.invalidateAggregate({
        streamId: 'unknown.Stream-xyz',
        cacheKey: 'scope:mystery',
        commandId: 'cmd-3',
        reason: 'event-less-response',
      }),
    ).not.toThrow()

    expect(scheduleSpy).not.toHaveBeenCalled()
  })

  it('passes the cache key through as a single-element array', () => {
    const scheduler = makeScheduler()
    const scheduleSpy = vi.spyOn(scheduler, 'schedule')

    scheduler.invalidateAggregate({
      streamId: 'nb.Todo-todo-1',
      cacheKey: 'scope:alpha',
      commandId: 'cmd-4',
      reason: 'event-less-response',
    })

    const call = scheduleSpy.mock.calls[0]
    expect(call?.[1]).toEqual(['scope:alpha'])
  })
})
