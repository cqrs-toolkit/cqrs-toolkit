import { Ajv } from 'ajv'
import { JSONSchema7 } from 'json-schema'
import { describe, expect, test } from 'vitest'
import { int64Visitor } from './int64Visitor.js'
import { HydrateFn, SchemaException } from './types.js'
import { ValidatorProvider } from './ValidatorProvider.js'

describe('ValidatorProvider', () => {
  describe('getValidator', () => {
    test('caching — same schema returns same validator', () => {
      const provider = makeProvider()
      const schema: JSONSchema7 = { type: 'string' }
      const v1 = provider.getValidator(schema)
      const v2 = provider.getValidator(schema)
      expect(v1).toBe(v2)
    })

    test('without AJV — assertion error', () => {
      const fresh = new ValidatorProvider()
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
      const provider = makeProvider()
      const res = provider.parse<{ name: string; age?: number }>(schema, {
        name: 'Alice',
        age: 30,
      })
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.value).toStrictEqual({ name: 'Alice', age: 30 })
    })

    test('invalid data returns Err with SchemaException', () => {
      const provider = makeProvider()
      const res = provider.parse(schema, { age: 'not-a-number' })
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.error).toBeInstanceOf(SchemaException)
      expect(res.error.details).toBeDefined()
      const paths = res.error.details!.map((e) => e.path)
      expect(paths).toContain('name')
      expect(paths).toContain('age')
    })

    test('auto-hydrates int64 string fields to BigInt', () => {
      const provider = makeProvider()
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
      const res = provider.parse<{ rev: bigint; name: string }>(int64Schema, data)
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.value.rev).toBe(42n)
      expect(res.value.name).toBe('test')
    })

    test('calls custom hydrate function on valid data', () => {
      const provider = makeProvider()
      const hydrate: HydrateFn = (data) => {
        ;(data as { name: string }).name = (data as { name: string }).name.toUpperCase()
      }

      const data = { name: 'alice' }
      const res = provider.parse<{ name: string }>(schema, data, hydrate)
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.value.name).toBe('ALICE')
    })

    test('does not call hydrate on invalid data', () => {
      const provider = makeProvider()
      let called = false
      const hydrate: HydrateFn = () => {
        called = true
      }

      const res = provider.parse(schema, { age: 'bad' }, hydrate)
      expect(res.ok).toBe(false)
      expect(called).toBe(false)
    })

    test('caches format paths — same schema reuses cache', () => {
      const provider = makeProvider()
      const int64Schema: JSONSchema7 = {
        type: 'object',
        properties: {
          count: { type: 'string', pattern: '^[0-9]+$', format: 'int64' },
        },
        required: ['count'],
        additionalProperties: false,
      }

      const data1 = { count: '10' }
      const res1 = provider.parse<{ count: bigint }>(int64Schema, data1)
      expect(res1.ok).toBe(true)
      if (!res1.ok) return
      expect(res1.value.count).toBe(10n)

      const data2 = { count: '20' }
      const res2 = provider.parse<{ count: bigint }>(int64Schema, data2)
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
      const provider = makeProvider()
      const res = provider.parseOnce<{ name: string; age?: number }>(schema, {
        name: 'Bob',
        age: 25,
      })
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.value).toStrictEqual({ name: 'Bob', age: 25 })
    })

    test('invalid data returns Err with SchemaException', () => {
      const provider = makeProvider()
      const res = provider.parseOnce(schema, { age: 'bad' })
      expect(res.ok).toBe(false)
      if (res.ok) return
      expect(res.error).toBeInstanceOf(SchemaException)
      expect(res.error.details).toBeDefined()
      const paths = res.error.details!.map((e) => e.path)
      expect(paths).toContain('name')
      expect(paths).toContain('age')
    })

    test('auto-hydrates int64 string fields to BigInt', () => {
      const provider = makeProvider()
      const int64Schema: JSONSchema7 = {
        type: 'object',
        properties: {
          rev: { type: 'string', pattern: '^[0-9]+$', format: 'int64' },
        },
        required: ['rev'],
        additionalProperties: false,
      }

      const data = { rev: '99' }
      const res = provider.parseOnce<{ rev: bigint }>(int64Schema, data)
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.value.rev).toBe(99n)
    })

    test('calls custom hydrate function on valid data', () => {
      const provider = makeProvider()
      const hydrate: HydrateFn = (data) => {
        ;(data as { name: string }).name = (data as { name: string }).name.toUpperCase()
      }

      const data = { name: 'bob' }
      const res = provider.parseOnce<{ name: string }>(schema, data, hydrate)
      expect(res.ok).toBe(true)
      if (!res.ok) return
      expect(res.value.name).toBe('BOB')
    })

    test('additionalProperties with int64 — hydration works identically to parse', () => {
      const provider = makeProvider()
      const addPropsSchema: JSONSchema7 = {
        type: 'object',
        properties: {
          label: { type: 'string' },
        },
        additionalProperties: { type: 'string', format: 'int64', pattern: '^[0-9]+$' },
      }

      // parseOnce path
      const data1 = { label: 'test', dyn1: '100', dyn2: '200' }
      const res1 = provider.parseOnce<Record<string, unknown>>(addPropsSchema, data1)
      expect(res1.ok).toBe(true)
      if (!res1.ok) return
      expect(res1.value).toStrictEqual({ label: 'test', dyn1: 100n, dyn2: 200n })

      // parse path (for comparison)
      const data2 = { label: 'test', dyn1: '100', dyn2: '200' }
      const res2 = provider.parse<Record<string, unknown>>(addPropsSchema, data2)
      expect(res2.ok).toBe(true)
      if (!res2.ok) return
      expect(res2.value).toStrictEqual({ label: 'test', dyn1: 100n, dyn2: 200n })
    })
  })
})

function makeProvider(): ValidatorProvider {
  const provider = new ValidatorProvider()
  const ajv = new Ajv({ allErrors: true })
  ajv.addFormat('int64', /^[0-9]+$/)
  provider.setAjv(ajv, [int64Visitor])
  return provider
}
