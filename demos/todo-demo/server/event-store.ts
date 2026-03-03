/**
 * Demo event store extending MockEventStore with global event log and subscriptions.
 */

import type { EventRevision, IEvent, Persisted, SaveEventResult } from '@meticoeus/ddd-es'
import { MockEventStore } from '@meticoeus/ddd-es/mocks'
import { v4 as uuidv4 } from 'uuid'

export type EventSubscriber = (event: Persisted<IEvent>) => void

export class DemoEventStore extends MockEventStore {
  private readonly _globalLog: Persisted<IEvent>[] = []
  private readonly _subscribers = new Set<EventSubscriber>()

  constructor() {
    super()
    this.returnSavedEvents = true
  }

  override async saveEvents<Event extends IEvent = IEvent>(
    streamName: string,
    events: Event[],
    expectedRevision: EventRevision,
  ): Promise<SaveEventResult<Event>> {
    // MockEventStore hardcodes id: 'Event:1'. Pre-assign unique IDs so the
    // client's EventCache deduplication works correctly.
    const identified = events.map((e) => ({ ...e, id: uuidv4() }))
    const result = await super.saveEvents(streamName, identified, expectedRevision)

    if (result.ok && result.value.events) {
      for (const event of result.value.events) {
        this._globalLog.push(event)
        for (const subscriber of this._subscribers) {
          subscriber(event)
        }
      }
    }

    return result
  }

  getGlobalEvents(afterPosition?: bigint, limit = 100): Persisted<IEvent>[] {
    let filtered: Persisted<IEvent>[]
    if (typeof afterPosition === 'bigint') {
      filtered = this._globalLog.filter((e) => e.position > afterPosition)
    } else {
      filtered = this._globalLog
    }
    return filtered.slice(0, limit)
  }

  clear(): void {
    this._globalLog.length = 0
    this._events.clear()
    this._position = 0n
  }

  subscribe(fn: EventSubscriber): () => void {
    this._subscribers.add(fn)
    return () => {
      this._subscribers.delete(fn)
    }
  }
}
