import { ErrorObject } from 'ajv'
import { JSONSchema7 } from 'json-schema'
import { beforeAll, describe, expect, test } from 'vitest'
import { bootstrapTestAjv } from './ajv.mocks.js'
import { EMPTY_STAR_MAP, type Int64Envelope } from './SchemaRegistry.js'
import { applyBigInt, buildInt64Paths, transformAjvErrors } from './utils.js'

describe('utils', () => {
  beforeAll(() => {
    bootstrapTestAjv()
  })

  describe('transformAjvErrors', () => {
    test('simple property path', () => {
      const errors: ErrorObject[] = [
        {
          keyword: 'type',
          instancePath: '/age',
          schemaPath: '#/properties/age/type',
          params: { type: 'number' },
          message: 'must be number',
        },
      ]
      const result = transformAjvErrors(errors)
      expect(result).toStrictEqual([
        { path: 'age', code: 'type', message: 'must be number', params: { type: 'number' } },
      ])
    })

    test('nested property path', () => {
      const errors: ErrorObject[] = [
        {
          keyword: 'minLength',
          instancePath: '/address/city',
          schemaPath: '#/properties/address/properties/city/minLength',
          params: { limit: 1 },
          message: 'must NOT have fewer than 1 characters',
        },
      ]
      const result = transformAjvErrors(errors)
      expect(result).toHaveLength(1)
      expect(result[0]!.path).toBe('address.city')
    })

    test('required keyword appends missingProperty to path', () => {
      const errors: ErrorObject[] = [
        {
          keyword: 'required',
          instancePath: '',
          schemaPath: '#/required',
          params: { missingProperty: 'name' },
          message: "must have required property 'name'",
        },
      ]
      const result = transformAjvErrors(errors)
      expect(result).toHaveLength(1)
      expect(result[0]!.path).toBe('name')
      expect(result[0]!.code).toBe('required')
    })

    test('nested required keyword appends missingProperty', () => {
      const errors: ErrorObject[] = [
        {
          keyword: 'required',
          instancePath: '/address',
          schemaPath: '#/properties/address/required',
          params: { missingProperty: 'city' },
          message: "must have required property 'city'",
        },
      ]
      const result = transformAjvErrors(errors)
      expect(result).toHaveLength(1)
      expect(result[0]!.path).toBe('address.city')
    })

    test('root-level error with empty instancePath', () => {
      const errors: ErrorObject[] = [
        {
          keyword: 'type',
          instancePath: '',
          schemaPath: '#/type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ]
      const result = transformAjvErrors(errors)
      expect(result).toHaveLength(1)
      expect(result[0]!.path).toBe('')
      expect(result[0]!.code).toBe('type')
    })
  })

  const Int64Schema: JSONSchema7 = { type: 'string', pattern: '^[0-9]+$', format: 'int64' }

  describe('buildInt64Paths', () => {
    test('flat int64 field', () => {
      const schema: JSONSchema7 = { type: 'object', properties: { rev: Int64Schema } }
      expect(buildInt64Paths(schema)).toStrictEqual(['.rev'])
    })

    test('no int64 fields', () => {
      const schema: JSONSchema7 = { type: 'object', properties: { name: { type: 'string' } } }
      expect(buildInt64Paths(schema)).toStrictEqual([])
    })

    test('nested int64', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: { a: { type: 'object', properties: { b: Int64Schema } } },
      }
      expect(buildInt64Paths(schema)).toStrictEqual(['.a.b'])
    })

    test('format int64 but type number — not collected', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: { x: { type: 'number', format: 'int64' } },
      }
      expect(buildInt64Paths(schema)).toStrictEqual([])
    })

    test('array of int64', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: { ids: { type: 'array', items: Int64Schema } },
      }
      expect(buildInt64Paths(schema)).toStrictEqual(['.ids[]'])
    })

    test('array of objects with int64', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'object', properties: { rev: Int64Schema } },
          },
        },
      }
      expect(buildInt64Paths(schema)).toStrictEqual(['.items[].rev'])
    })

    test('tuple with int64 at index 1', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          coords: { type: 'array', items: [{ type: 'string' }, Int64Schema] },
        },
      }
      expect(buildInt64Paths(schema)).toStrictEqual(['.coords[1]'])
    })

    test('anyOf union (RevisionSchema pattern)', () => {
      const RevisionSchema: JSONSchema7 = { anyOf: [{ const: 'latest' }, Int64Schema] }
      const schema: JSONSchema7 = { type: 'object', properties: { rev: RevisionSchema } }
      expect(buildInt64Paths(schema)).toStrictEqual(['.rev'])
    })

    test('oneOf union', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: { x: { oneOf: [{ type: 'string' }, Int64Schema] } },
      }
      expect(buildInt64Paths(schema)).toStrictEqual(['.x'])
    })

    test('no duplicate paths from combinators', () => {
      const schema: JSONSchema7 = { anyOf: [Int64Schema, Int64Schema] }
      expect(buildInt64Paths(schema)).toStrictEqual([''])
    })

    test('empty schema', () => {
      expect(buildInt64Paths({})).toStrictEqual([])
    })
  })

  describe('applyBigInt', () => {
    test('flat conversion', () => {
      const data = { rev: '42' }
      applyBigInt(data, env(['.rev']))
      expect(data).toStrictEqual({ rev: 42n })
    })

    test('leaves non-bigint string unchanged', () => {
      const data = { rev: 'latest' }
      applyBigInt(data, env(['.rev']))
      expect(data).toStrictEqual({ rev: 'latest' })
    })

    test('nested conversion', () => {
      const data = { a: { b: '99' } }
      applyBigInt(data, env(['.a.b']))
      expect(data).toStrictEqual({ a: { b: 99n } })
    })

    test('array of scalars', () => {
      const data = { ids: ['1', '2'] }
      applyBigInt(data, env(['.ids[]']))
      expect(data).toStrictEqual({ ids: [1n, 2n] })
    })

    test('array of objects', () => {
      const data = { items: [{ rev: '5' }, { rev: '10' }] }
      applyBigInt(data, env(['.items[].rev']))
      expect(data).toStrictEqual({ items: [{ rev: 5n }, { rev: 10n }] })
    })

    test('mixed union in array', () => {
      const data = { items: [{ rev: '5' }, { rev: 'latest' }] }
      applyBigInt(data, env(['.items[].rev']))
      expect(data).toStrictEqual({ items: [{ rev: 5n }, { rev: 'latest' }] })
    })

    test('tuple indexed conversion', () => {
      const data = { coords: ['hello', '99'] }
      applyBigInt(data, env(['.coords[1]']))
      expect(data).toStrictEqual({ coords: ['hello', 99n] })
    })

    test('tuple index leaves non-bigint string', () => {
      const data = { coords: ['hello', 'world'] }
      applyBigInt(data, env(['.coords[1]']))
      expect(data).toStrictEqual({ coords: ['hello', 'world'] })
    })

    test('missing path in data — no crash', () => {
      const data = { other: 'x' }
      applyBigInt(data, env(['.rev']))
      expect(data).toStrictEqual({ other: 'x' })
    })

    test('null traversal — no crash', () => {
      const data = { a: null }
      applyBigInt(data, env(['.a.b']))
      expect(data).toStrictEqual({ a: null })
    })

    test('no paths = no-op', () => {
      const data = { rev: '42' }
      applyBigInt(data, env([]))
      expect(data).toStrictEqual({ rev: '42' })
    })

    test('non-string value at path — unchanged', () => {
      const data = { rev: 42 }
      applyBigInt(data, env(['.rev']))
      expect(data).toStrictEqual({ rev: 42 })
    })

    test('star path — converts dynamic keys, skips excluded', () => {
      const data = { name: 'Alice', dyn1: '100', dyn2: '200' }
      const envelope: Int64Envelope = {
        paths: ['.*'],
        starMap: new Map([['.*', ['name']]]),
      }
      applyBigInt(data, envelope)
      expect(data).toStrictEqual({ name: 'Alice', dyn1: 100n, dyn2: 200n })
    })

    test('star path — nested suffix after *', () => {
      const data = { known: { rev: '1' }, extra: { rev: '2' } }
      const envelope: Int64Envelope = {
        paths: ['.*.rev'],
        starMap: new Map([['.*', ['known']]]),
      }
      applyBigInt(data, envelope)
      expect(data).toStrictEqual({ known: { rev: '1' }, extra: { rev: 2n } })
    })

    test('star path — no starMap entry, converts all keys', () => {
      const data = { a: '10', b: '20', c: 'nope' }
      applyBigInt(data, env(['.*']))
      expect(data).toStrictEqual({ a: 10n, b: 20n, c: 'nope' })
    })

    test('star path — multiple star segments', () => {
      const data = {
        groups: [
          { known: 'skip', x: '1', y: '2' },
          { known: 'skip', z: '3' },
        ],
      }
      const envelope: Int64Envelope = {
        paths: ['.groups[].*'],
        starMap: new Map([['.*', ['known']]]),
      }
      applyBigInt(data, envelope)
      expect(data).toStrictEqual({
        groups: [
          { known: 'skip', x: 1n, y: 2n },
          { known: 'skip', z: 3n },
        ],
      })
    })

    test('star path — missing parent, no crash', () => {
      const data = { other: 'x' }
      const envelope: Int64Envelope = {
        paths: ['.missing.*'],
        starMap: new Map(),
      }
      applyBigInt(data, envelope)
      expect(data).toStrictEqual({ other: 'x' })
    })
  })

  describe('buildInt64Paths + applyBigInt round-trip', () => {
    test('real-world schema with int64, revision union, nested object, and array of objects', () => {
      const RevisionSchema: JSONSchema7 = { anyOf: [{ const: 'latest' }, Int64Schema] }
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          nextExpectedRevision: Int64Schema,
          revision: RevisionSchema,
          nested: {
            type: 'object',
            properties: { formRevision: Int64Schema },
          },
          responses: {
            type: 'array',
            items: {
              type: 'object',
              properties: { rev: Int64Schema, label: { type: 'string' } },
            },
          },
        },
      }

      const paths = buildInt64Paths(schema)
      expect(paths).toStrictEqual([
        '.nextExpectedRevision',
        '.revision',
        '.nested.formRevision',
        '.responses[].rev',
      ])

      const data = {
        nextExpectedRevision: '100',
        revision: 'latest',
        nested: { formRevision: '7' },
        responses: [
          { rev: '1', label: 'first' },
          { rev: '2', label: 'second' },
        ],
      }

      applyBigInt(data, env(paths))

      expect(data).toStrictEqual({
        nextExpectedRevision: 100n,
        revision: 'latest',
        nested: { formRevision: 7n },
        responses: [
          { rev: 1n, label: 'first' },
          { rev: 2n, label: 'second' },
        ],
      })
    })
  })
})

function env(paths: string[]): Int64Envelope {
  return { paths, starMap: EMPTY_STAR_MAP }
}
