/**
 * Gap detector for event streams.
 * Detects missing events in a sequence by position.
 */

/**
 * Represents a gap in the event sequence.
 */
export interface EventGap {
  /** Start position (exclusive - last known good position) */
  fromPosition: bigint
  /** End position (exclusive - first known position after gap) */
  toPosition: bigint
  /** Stream ID if the gap is stream-specific */
  streamId?: string
}

/**
 * Gap detection result.
 */
export interface GapDetectionResult {
  /** Whether there are any gaps */
  hasGaps: boolean
  /** List of detected gaps */
  gaps: EventGap[]
  /** Highest position seen */
  highestPosition: bigint
}

/**
 * Detect gaps in a sequence of positions.
 *
 * @param positions - Array of positions (can be unsorted)
 * @param knownHighest - Previously known highest position (for detecting leading gaps)
 * @returns Gap detection result
 */
export function detectGaps(positions: bigint[], knownHighest?: bigint): GapDetectionResult {
  if (positions.length === 0) {
    return {
      hasGaps: false,
      gaps: [],
      highestPosition: knownHighest ?? BigInt(0),
    }
  }

  // Sort positions
  const sorted = [...positions].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  const gaps: EventGap[] = []

  // Check for leading gap (if we know the previous highest)
  if (knownHighest !== undefined) {
    const expectedNext = knownHighest + BigInt(1)
    const firstReceived = sorted[0]
    if (firstReceived !== undefined && firstReceived > expectedNext) {
      gaps.push({
        fromPosition: knownHighest,
        toPosition: firstReceived,
      })
    }
  }

  // Check for internal gaps
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    if (prev !== undefined && curr !== undefined) {
      const expectedNext = prev + BigInt(1)
      if (curr > expectedNext) {
        gaps.push({
          fromPosition: prev,
          toPosition: curr,
        })
      }
    }
  }

  const lastPosition = sorted[sorted.length - 1]
  return {
    hasGaps: gaps.length > 0,
    gaps,
    highestPosition: lastPosition ?? knownHighest ?? BigInt(0),
  }
}

/**
 * Gap buffer for accumulating events while waiting for gap repair.
 */
export class GapBuffer {
  private buffer: Map<string, { position: bigint; event: unknown }[]> = new Map()
  private knownPositions: Map<string, bigint> = new Map()

  /**
   * Add an event to the buffer.
   *
   * @param streamId - Stream identifier (or 'global' for cross-stream)
   * @param position - Event position
   * @param event - The event data
   * @returns Whether this created a new gap
   */
  add(streamId: string, position: bigint, event: unknown): boolean {
    let events = this.buffer.get(streamId)
    if (!events) {
      events = []
      this.buffer.set(streamId, events)
    }

    events.push({ position, event })

    const knownHighest = this.knownPositions.get(streamId)
    if (knownHighest !== undefined) {
      const expectedNext = knownHighest + BigInt(1)
      if (position > expectedNext) {
        return true // Gap detected
      }
    }

    // Update known position
    if (knownHighest === undefined || position > knownHighest) {
      this.knownPositions.set(streamId, position)
    }

    return false
  }

  /**
   * Get all buffered events for a stream, sorted by position.
   *
   * @param streamId - Stream identifier
   * @returns Sorted events
   */
  getEvents(streamId: string): { position: bigint; event: unknown }[] {
    const events = this.buffer.get(streamId) ?? []
    return [...events].sort((a, b) =>
      a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
    )
  }

  /**
   * Clear events for a stream up to a position.
   *
   * @param streamId - Stream identifier
   * @param upToPosition - Clear events with position <= this
   */
  clearUpTo(streamId: string, upToPosition: bigint): void {
    const events = this.buffer.get(streamId)
    if (!events) return

    const remaining = events.filter((e) => e.position > upToPosition)
    if (remaining.length === 0) {
      this.buffer.delete(streamId)
    } else {
      this.buffer.set(streamId, remaining)
    }
  }

  /**
   * Clear all buffered events.
   */
  clear(): void {
    this.buffer.clear()
    this.knownPositions.clear()
  }

  /**
   * Get detected gaps for all streams.
   *
   * @returns Map of stream ID to gaps
   */
  getGaps(): Map<string, EventGap[]> {
    const result = new Map<string, EventGap[]>()

    for (const [streamId, events] of this.buffer) {
      const positions = events.map((e) => e.position)
      const detection = detectGaps(positions, this.knownPositions.get(streamId))
      if (detection.hasGaps) {
        result.set(streamId, detection.gaps)
      }
    }

    return result
  }

  /**
   * Set the known highest position for a stream.
   * Used when resuming from persisted state.
   *
   * @param streamId - Stream identifier
   * @param position - Known highest position
   */
  setKnownPosition(streamId: string, position: bigint): void {
    this.knownPositions.set(streamId, position)
  }
}
