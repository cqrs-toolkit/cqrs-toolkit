import { describe, expect, test } from 'vitest'
import { int64Visitor } from './int64Visitor.js'

describe('int64Visitor', () => {
  describe('match', () => {
    test('returns true for { type: string, format: int64 }', () => {
      expect(int64Visitor.match({ type: 'string', format: 'int64' })).toBe(true)
    })

    test('returns false for { type: number, format: int64 }', () => {
      expect(int64Visitor.match({ type: 'number', format: 'int64' })).toBe(false)
    })

    test('returns false for { type: string } with no format', () => {
      expect(int64Visitor.match({ type: 'string' })).toBe(false)
    })

    test('returns false for { type: string, format: date-time }', () => {
      expect(int64Visitor.match({ type: 'string', format: 'date-time' })).toBe(false)
    })
  })

  describe('hydrate', () => {
    test('converts numeric string to bigint', () => {
      expect(int64Visitor.hydrate('42', undefined)).toBe(42n)
    })

    test('converts zero', () => {
      expect(int64Visitor.hydrate('0', undefined)).toBe(0n)
    })

    test('converts beyond MAX_SAFE_INTEGER', () => {
      expect(int64Visitor.hydrate('9007199254740993', undefined)).toBe(9007199254740993n)
    })

    test('returns undefined for non-numeric string', () => {
      expect(int64Visitor.hydrate('hello', undefined)).toBeUndefined()
    })

    test('returns undefined for empty string', () => {
      expect(int64Visitor.hydrate('', undefined)).toBeUndefined()
    })
  })
})
