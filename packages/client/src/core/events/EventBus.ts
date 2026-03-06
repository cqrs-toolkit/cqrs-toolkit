/**
 * RxJS-based event bus for library events.
 * Provides a centralized way to emit and subscribe to library-level events.
 */

import { Observable, Subject, filter, share } from 'rxjs'
import type { LibraryEvent, LibraryEventPayloads, LibraryEventType } from '../../types/events.js'

/**
 * Event bus for library-level events.
 * All components can emit events, and consumers can subscribe to specific event types.
 */
export class EventBus {
  private readonly subject = new Subject<LibraryEvent>()

  /**
   * Whether debug events are enabled.
   * Mutable so the worker can enable debug after startup via RPC.
   * When false, `emitDebug()` is a no-op.
   */
  debug = false

  /**
   * Observable of all library events.
   */
  readonly events$: Observable<LibraryEvent>

  constructor() {
    // Share the subject so multiple subscribers get the same events
    this.events$ = this.subject.asObservable().pipe(share())
  }

  /**
   * Emit a library event.
   *
   * @param type - Event type
   * @param payload - Event payload
   */
  emit<T extends LibraryEventType>(type: T, payload: LibraryEventPayloads[T]): void {
    const event: LibraryEvent<T> = {
      type,
      payload,
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
   * @param payload - Event payload
   */
  emitDebug<T extends LibraryEventType>(type: T, payload: LibraryEventPayloads[T]): void {
    if (!this.debug) return
    const event: LibraryEvent<T> = {
      type,
      payload,
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
  on<T extends LibraryEventType>(type: T): Observable<LibraryEvent<T>> {
    return this.events$.pipe(filter((event): event is LibraryEvent<T> => event.type === type))
  }

  /**
   * Get an observable filtered to multiple event types.
   *
   * @param types - Event types to filter for
   * @returns Observable of events of those types
   */
  onAny<T extends LibraryEventType>(types: T[]): Observable<LibraryEvent<T>> {
    return this.events$.pipe(
      filter((event): event is LibraryEvent<T> => types.includes(event.type as T)),
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
