/**
 * Serialization utilities for worker communication.
 *
 * Handles special types like BigInt and Date that cannot be directly
 * serialized via structured clone algorithm used by postMessage.
 */

/**
 * Serialization marker for special types.
 */
interface SerializedValue {
  __serialized__: true
  type: 'bigint' | 'date' | 'undefined' | 'map' | 'set'
  value: string
}

/**
 * Check if a value is a serialization marker.
 */
function isSerializedValue(value: unknown): value is SerializedValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__serialized__' in value &&
    (value as SerializedValue).__serialized__ === true
  )
}

/**
 * Serialize a value for postMessage.
 * Converts BigInt and Date to serialization markers.
 *
 * @param value - Value to serialize
 * @returns Serialized value safe for postMessage
 */
export function serialize<T>(value: T): unknown {
  return serializeRecursive(value, new WeakSet())
}

function serializeRecursive(value: unknown, seen: WeakSet<object>): unknown {
  // Handle null
  if (value === null) {
    return null
  }

  // Handle undefined
  if (value === undefined) {
    return { __serialized__: true, type: 'undefined', value: '' } as SerializedValue
  }

  // Handle primitives
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  // Handle BigInt
  if (typeof value === 'bigint') {
    return { __serialized__: true, type: 'bigint', value: value.toString() } as SerializedValue
  }

  // Handle Date
  if (value instanceof Date) {
    return { __serialized__: true, type: 'date', value: value.toISOString() } as SerializedValue
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item) => serializeRecursive(item, seen))
  }

  // Handle objects
  if (typeof value === 'object') {
    // Circular reference check
    if (seen.has(value)) {
      throw new Error('Circular reference detected during serialization')
    }
    seen.add(value)

    // Handle Map
    if (value instanceof Map) {
      const entries: [unknown, unknown][] = []
      for (const [k, v] of value) {
        entries.push([serializeRecursive(k, seen), serializeRecursive(v, seen)])
      }
      return {
        __serialized__: true,
        type: 'map',
        value: JSON.stringify(entries),
      } as SerializedValue
    }

    // Handle Set
    if (value instanceof Set) {
      const values: unknown[] = []
      for (const v of value) {
        values.push(serializeRecursive(v, seen))
      }
      return { __serialized__: true, type: 'set', value: JSON.stringify(values) } as SerializedValue
    }

    // Handle plain objects
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeRecursive(val, seen)
    }
    return result
  }

  // Functions and symbols cannot be serialized
  if (typeof value === 'function' || typeof value === 'symbol') {
    throw new Error(`Cannot serialize ${typeof value}`)
  }

  return value
}

/**
 * Deserialize a value from postMessage.
 * Converts serialization markers back to original types.
 *
 * @param value - Serialized value
 * @returns Deserialized value
 */
export function deserialize<T>(value: unknown): T {
  return deserializeRecursive(value) as T
}

function deserializeRecursive(value: unknown): unknown {
  // Handle null
  if (value === null) {
    return null
  }

  // Handle primitives
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item) => deserializeRecursive(item))
  }

  // Handle serialization markers
  if (isSerializedValue(value)) {
    switch (value.type) {
      case 'bigint':
        return BigInt(value.value)
      case 'date':
        return new Date(value.value)
      case 'undefined':
        return undefined
      case 'map': {
        const entries = JSON.parse(value.value) as [unknown, unknown][]
        return new Map(entries.map(([k, v]) => [deserializeRecursive(k), deserializeRecursive(v)]))
      }
      case 'set': {
        const values = JSON.parse(value.value) as unknown[]
        return new Set(values.map((v) => deserializeRecursive(v)))
      }
    }
  }

  // Handle objects
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = deserializeRecursive(val)
    }
    return result
  }

  return value
}

/**
 * Create a structured clone-safe copy of a value.
 * Use this before postMessage when you're unsure if a value contains special types.
 *
 * @param value - Value to prepare for postMessage
 * @returns Clone-safe value
 */
export function prepareForTransfer<T>(value: T): unknown {
  return serialize(value)
}

/**
 * Restore a value from a postMessage transfer.
 *
 * @param value - Transferred value
 * @returns Restored value
 */
export function restoreFromTransfer<T>(value: unknown): T {
  return deserialize<T>(value)
}
