/**
 * Unit tests for serialization utilities.
 */

import { describe, expect, it } from 'vitest'
import { deserialize, prepareForTransfer, restoreFromTransfer, serialize } from './serialization.js'

describe('serialization', () => {
  describe('serialize/deserialize', () => {
    it('handles primitives', () => {
      expect(deserialize(serialize('hello'))).toBe('hello')
      expect(deserialize(serialize(42))).toBe(42)
      expect(deserialize(serialize(true))).toBe(true)
      expect(deserialize(serialize(false))).toBe(false)
      expect(deserialize(serialize(null))).toBe(null)
    })

    it('handles undefined', () => {
      expect(deserialize(serialize(undefined))).toBe(undefined)
    })

    it('handles BigInt', () => {
      const big = BigInt('9007199254740993')
      const result = deserialize<bigint>(serialize(big))
      expect(result).toBe(big)
    })

    it('handles Date', () => {
      const date = new Date('2024-01-15T10:30:00.000Z')
      const result = deserialize<Date>(serialize(date))
      expect(result).toBeInstanceOf(Date)
      expect(result.toISOString()).toBe(date.toISOString())
    })

    it('handles arrays', () => {
      const arr = [1, 'two', BigInt(3), new Date('2024-01-01')]
      const result = deserialize<unknown[]>(serialize(arr))
      expect(result[0]).toBe(1)
      expect(result[1]).toBe('two')
      expect(result[2]).toBe(BigInt(3))
      expect((result[3] as Date).toISOString()).toBe('2024-01-01T00:00:00.000Z')
    })

    it('handles nested objects', () => {
      const obj = {
        name: 'test',
        count: BigInt(100),
        date: new Date('2024-06-15'),
        nested: {
          value: 42,
          bigValue: BigInt(999),
        },
      }

      const result = deserialize<typeof obj>(serialize(obj))
      expect(result.name).toBe('test')
      expect(result.count).toBe(BigInt(100))
      expect(result.date.toISOString()).toBe('2024-06-15T00:00:00.000Z')
      expect(result.nested.value).toBe(42)
      expect(result.nested.bigValue).toBe(BigInt(999))
    })

    it('handles objects with undefined values', () => {
      const obj = { a: 1, b: undefined, c: 'test' }
      const result = deserialize<typeof obj>(serialize(obj))
      expect(result.a).toBe(1)
      expect(result.b).toBe(undefined)
      expect(result.c).toBe('test')
    })

    it('throws on circular references', () => {
      const obj: Record<string, unknown> = { name: 'test' }
      obj.self = obj

      expect(() => serialize(obj)).toThrow('Circular reference')
    })

    it('throws on deeply nested circular references', () => {
      const a: Record<string, unknown> = { name: 'a' }
      const b: Record<string, unknown> = { name: 'b', parent: a }
      a.child = b

      expect(() => serialize(a)).toThrow('Circular reference')
    })

    it('throws on circular references through arrays', () => {
      const obj: Record<string, unknown> = { name: 'test' }
      obj.items = [obj]

      expect(() => serialize(obj)).toThrow('Circular reference')
    })

    it('allows shared references (diamond shape)', () => {
      const shared = { id: 'shared-1', value: 42 }
      const obj = { a: shared, b: shared }

      const result = deserialize<typeof obj>(serialize(obj))
      expect(result.a).toEqual({ id: 'shared-1', value: 42 })
      expect(result.b).toEqual({ id: 'shared-1', value: 42 })
    })

    it('allows shared references across object and array', () => {
      const shared = { id: 'ref-1' }
      const obj = {
        command: { affectedAggregates: [{ link: shared }] },
        events: [{ data: shared }],
      }

      const result = deserialize<typeof obj>(serialize(obj))
      expect(result.command.affectedAggregates[0]?.link).toEqual({ id: 'ref-1' })
      expect(result.events[0]?.data).toEqual({ id: 'ref-1' })
    })

    it('allows the same object referenced in sibling array entries', () => {
      const shared = { value: 'same' }
      const arr = [shared, shared, shared]

      const result = deserialize<typeof arr>(serialize(arr))
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ value: 'same' })
      expect(result[1]).toEqual({ value: 'same' })
      expect(result[2]).toEqual({ value: 'same' })
    })

    it('throws on functions', () => {
      const obj = { fn: () => {} }
      expect(() => serialize(obj)).toThrow('Cannot serialize function')
    })

    it('throws on symbols', () => {
      const obj = { sym: Symbol('test') }
      expect(() => serialize(obj)).toThrow('Cannot serialize symbol')
    })
  })

  describe('prepareForTransfer/restoreFromTransfer', () => {
    it('round-trips complex objects', () => {
      const original = {
        id: 'abc123',
        timestamp: BigInt(Date.now()),
        created: new Date(),
        items: [1, 2, BigInt(3)],
        metadata: {
          version: 1,
          lastModified: new Date('2024-01-01'),
        },
      }

      const transferred = prepareForTransfer(original)
      const restored = restoreFromTransfer<typeof original>(transferred)

      expect(restored.id).toBe(original.id)
      expect(restored.timestamp).toBe(original.timestamp)
      expect(restored.created.toISOString()).toBe(original.created.toISOString())
      expect(restored.items).toEqual([1, 2, BigInt(3)])
      expect(restored.metadata.version).toBe(1)
      expect(restored.metadata.lastModified.toISOString()).toBe('2024-01-01T00:00:00.000Z')
    })
  })
})
