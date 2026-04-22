/**
 * RxJS-based event bus for library events.
 * Provides a centralized way to emit and subscribe to library-level events.
 */

import type { Link } from '@meticoeus/ddd-es'
import { Observable, Subject, filter, share } from 'rxjs'
import type { LibraryEvent, LibraryEventData, LibraryEventType } from '../../types/events.js'

/**
 * Narrow interface for "something you can emit a debug event to".
 *
 * Exists so {@link EventBusLogger} can target either a real {@link EventBus}
 * (online-only mode) or a main-thread local sink (worker mode) without
 * pulling in the full bus API. No `debug` gate: consumers of this interface
 * are constructed conditionally in debug mode, so every call is expected
 * to emit.
 */
export interface IDebugEventSink<TLink extends Link> {
  emitDebug<T extends LibraryEventType>(type: T, data: LibraryEventData<TLink>[T]): void
}

/**
 * Minimal emit surface for library events — `emit` for normal events,
 * `emitDebug` for debug-only events that callers should be free to fire
 * unconditionally (implementations gate based on their own debug config).
 *
 * Structurally satisfied by {@link EventBus} and by
 * {@link WorkerMessageChannel} when it needs to surface local events on
 * this thread's `libraryEvents$` stream.
 */
export interface IEventSink<TLink extends Link> extends IDebugEventSink<TLink> {
  emit<T extends LibraryEventType>(type: T, data: LibraryEventData<TLink>[T]): void
}

/**
 * Event bus for library-level events.
 * All components can emit events, and consumers can subscribe to specific event types.
 */
export class EventBus<TLink extends Link> implements IEventSink<TLink> {
  private readonly subject = new Subject<LibraryEvent<TLink>>()

  /**
   * Whether debug events are enabled.
   * Mutable so the worker can enable debug after startup via RPC.
   * When false, `emitDebug()` is a no-op.
   */
  debug = false

  /**
   * Observable of all library events.
   */
  readonly events$: Observable<LibraryEvent<TLink>>

  constructor() {
    // Share the subject so multiple subscribers get the same events
    this.events$ = this.subject.asObservable().pipe(share())
  }

  /**
   * Emit a library event.
   *
   * @param type - Event type
   * @param data - Event data
   */
  emit<T extends LibraryEventType>(type: T, data: LibraryEventData<TLink>[T]): void {
    const event: LibraryEvent<TLink, T> = {
      type,
      data,
      timestamp: Date.now(),
    }
    this.subject.next(event)
  }

  /**
   * Emit a debug-only library event.
   * No-op when `this.debug` is false. When enabled, emits with `debug: true`
   * on the envelope so consumers can distinguish debug events.
   *
   * @param type - Event type
   * @param data - Event data
   */
  emitDebug<T extends LibraryEventType>(type: T, data: LibraryEventData<TLink>[T]): void {
    if (!this.debug) return
    const event: LibraryEvent<TLink, T> = {
      type,
      data,
      timestamp: Date.now(),
      debug: true,
    }
    this.subject.next(event)
  }

  /**
   * Get an observable filtered to a specific event type.
   *
   * @param type - Event type to filter for
   * @returns Observable of events of that type
   */
  on<T extends LibraryEventType>(type: T): Observable<LibraryEvent<TLink, T>> {
    return this.events$.pipe(
      filter((event): event is LibraryEvent<TLink, T> => event.type === type),
    )
  }

  /**
   * Get an observable filtered to multiple event types.
   *
   * @param types - Event types to filter for
   * @returns Observable of events of those types
   */
  onAny<T extends LibraryEventType>(types: T[]): Observable<LibraryEvent<TLink, T>> {
    return this.events$.pipe(
      filter((event): event is LibraryEvent<TLink, T> => types.includes(event.type as T)),
    )
  }

  /**
   * Complete the event bus.
   * Should be called when the client is destroyed.
   */
  complete(): void {
    this.subject.complete()
  }
}
