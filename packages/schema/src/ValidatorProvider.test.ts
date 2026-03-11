import { JSONSchema7 } from 'json-schema'
import { beforeAll, describe, expect, test } from 'vitest'
import { bootstrapTestAjv } from './ajv.mocks.js'
import { HydrateFn, SchemaException } from './types.js'
import { validatorProvider } from './ValidatorProvider.js'

describe('ValidatorProvider', () => {
  beforeAll(() => {
    bootstrapTestAjv()
  })

  describe('getValidator', () => {
    test('caching — same schema returns same validator', () => {
      const schema: JSONSchema7 = { type: 'string' }
      const v1 = validatorProvider.getValidator(schema)
      const v2 = validatorProvider.getValidator(schema)
      expect(v1).toBe(v2)
    })

    test('without AJV — assertion error', () => {
      const fresh = new (validatorProvider.constructor as new () => typeof validatorProvider)()
      expect(() => fresh.getValidator({ type: 'string' })).toThrow(/not initialized/)
    })
  })

  describe('parse', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
      additionalProperties: false,
    }

    test('valid data returns Ok with value', () => {
      const res = validatorProvider.parse<{ name: string; age?: number }>(schema, {
        name: 'Alice',
        age: 30,
      })
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.value).toStrictEqual({ name: 'Alice', age: 30 })
    })

    test('invalid data returns Err with SchemaException', () => {
      const res = validatorProvider.parse(schema, { age: 'not-a-number' })
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.error).toBeInstanceOf(SchemaException)
      expect(res.error.details).toBeDefined()
      const paths = res.error.details!.map((e) => e.path)
      expect(paths).toContain('name')
      expect(paths).toContain('age')
    })

    test('auto-hydrates int64 string fields to BigInt', () => {
      const int64Schema: JSONSchema7 = {
        type: 'object',
        properties: {
          rev: { type: 'string', pattern: '^[0-9]+$', format: 'int64' },
          name: { type: 'string' },
        },
        required: ['rev', 'name'],
        additionalProperties: false,
      }

      const data = { rev: '42', name: 'test' }
      const res = validatorProvider.parse<{ rev: bigint; name: string }>(int64Schema, data)
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.value.rev).toBe(42n)
      expect(res.value.name).toBe('test')
    })

    test('calls custom hydrate function on valid data', () => {
      const hydrate: HydrateFn = (data) => {
        ;(data as { name: string }).name = (data as { name: string }).name.toUpperCase()
      }

      const data = { name: 'alice' }
      const res = validatorProvider.parse<{ name: string }>(schema, data, hydrate)
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.value.name).toBe('ALICE')
    })

    test('does not call hydrate on invalid data', () => {
      let called = false
      const hydrate: HydrateFn = () => {
        called = true
      }

      const res = validatorProvider.parse(schema, { age: 'bad' }, hydrate)
      expect(res.ok).toBe(false)
      expect(called).toBe(false)
    })

    test('caches format paths — same schema reuses cache', () => {
      const int64Schema: JSONSchema7 = {
        type: 'object',
        properties: {
          count: { type: 'string', pattern: '^[0-9]+$', format: 'int64' },
        },
        required: ['count'],
        additionalProperties: false,
      }

      const data1 = { count: '10' }
      const res1 = validatorProvider.parse<{ count: bigint }>(int64Schema, data1)
      expect(res1.ok).toBe(true)
      if (!res1.ok) return
      expect(res1.value.count).toBe(10n)

      const data2 = { count: '20' }
      const res2 = validatorProvider.parse<{ count: bigint }>(int64Schema, data2)
      expect(res2.ok).toBe(true)
      if (!res2.ok) return
      expect(res2.value.count).toBe(20n)
    })
  })

  describe('parseOnce', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
      additionalProperties: false,
    }

    test('valid data returns Ok with value', () => {
      const res = validatorProvider.parseOnce<{ name: string; age?: number }>(schema, {
        name: 'Bob',
        age: 25,
      })
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.value).toStrictEqual({ name: 'Bob', age: 25 })
    })

    test('invalid data returns Err with SchemaException', () => {
      const res = validatorProvider.parseOnce(schema, { age: 'bad' })
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.error).toBeInstanceOf(SchemaException)
      expect(res.error.details).toBeDefined()
      const paths = res.error.details!.map((e) => e.path)
      expect(paths).toContain('name')
      expect(paths).toContain('age')
    })

    test('auto-hydrates int64 string fields to BigInt', () => {
      const int64Schema: JSONSchema7 = {
        type: 'object',
        properties: {
          rev: { type: 'string', pattern: '^[0-9]+$', format: 'int64' },
        },
        required: ['rev'],
        additionalProperties: false,
      }

      const data = { rev: '99' }
      const res = validatorProvider.parseOnce<{ rev: bigint }>(int64Schema, data)
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.value.rev).toBe(99n)
    })

    test('calls custom hydrate function on valid data', () => {
      const hydrate: HydrateFn = (data) => {
        ;(data as { name: string }).name = (data as { name: string }).name.toUpperCase()
      }

      const data = { name: 'bob' }
      const res = validatorProvider.parseOnce<{ name: string }>(schema, data, hydrate)
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.value.name).toBe('BOB')
    })
  })
})
