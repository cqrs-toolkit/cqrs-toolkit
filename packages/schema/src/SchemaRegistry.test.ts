import { Ajv } from 'ajv'
import type { FormatsPluginOptions } from 'ajv-formats'
import formatsModule from 'ajv-formats'
import type { JSONSchema7 } from 'json-schema'
import { beforeEach, describe, expect, test } from 'vitest'
import { int64Visitor } from './int64Visitor.js'
import { SchemaRegistry } from './SchemaRegistry.js'
import type { HydrationEnvelope, SchemaVisitor } from './types.js'

describe('SchemaRegistry', () => {
  let ajv: Ajv
  let registry: SchemaRegistry

  beforeEach(() => {
    ajv = freshAjv()
    registry = new SchemaRegistry(ajv, [int64Visitor])
  })

  describe('$ref wiring', () => {
    test('$id detection + $ref replacement', () => {
      const coreId = makeCoreId()
      const schema: JSONSchema7 = {
        type: 'object',
        properties: { name: coreId },
        required: ['name'],
      }

      registry.register(schema)

      expect(schema.properties?.['name']).toStrictEqual({ $ref: 'urn:test:core.Id' })
      expect(registry.getCommonSchemas().get('urn:test:core.Id')).toBe(coreId)
    })

    test('nested $id cascading — CoreLink contains CoreId + CoreRev', () => {
      const coreId = makeCoreId()
      const coreRev = makeCoreRev()
      const coreLink = makeCoreLink(coreId, coreRev)

      const schema: JSONSchema7 = {
        type: 'object',
        properties: { link: coreLink },
      }

      registry.register(schema)

      const common = registry.getCommonSchemas()
      expect(common.has('urn:test:core.Id')).toBe(true)
      expect(common.has('urn:test:core.Rev')).toBe(true)
      expect(common.has('urn:test:core.Link')).toBe(true)

      // Parent replaced with $ref
      expect(schema.properties?.['link']).toStrictEqual({ $ref: 'urn:test:core.Link' })
      // Inner properties also replaced
      expect(coreLink.properties?.['id']).toStrictEqual({ $ref: 'urn:test:core.Id' })
      expect(coreLink.properties?.['rev']).toStrictEqual({ $ref: 'urn:test:core.Rev' })
    })

    test('combinator branches — oneOf with $id branch replaced with $ref', () => {
      const coreId = makeCoreId()
      const schema: JSONSchema7 = {
        oneOf: [{ type: 'null' }, coreId],
      }

      registry.register(schema)

      expect(schema.oneOf?.[1]).toStrictEqual({ $ref: 'urn:test:core.Id' })
      expect(registry.getCommonSchemas().has('urn:test:core.Id')).toBe(true)
    })

    test('additionalProperties with $id replaced with $ref', () => {
      const coreId = makeCoreId()
      const coreDict = makeCoreDict(coreId)

      const schema: JSONSchema7 = {
        type: 'object',
        properties: { dict: coreDict },
      }

      registry.register(schema)

      expect(schema.properties?.['dict']).toStrictEqual({ $ref: 'urn:test:core.Dict' })
      expect(coreDict.additionalProperties).toStrictEqual({ $ref: 'urn:test:core.Id' })
    })

    test('multiple schemas sharing common — registered once, both get $ref', () => {
      const coreId = makeCoreId()

      const schema1: JSONSchema7 = {
        type: 'object',
        properties: { a: coreId },
      }
      const schema2: JSONSchema7 = {
        type: 'object',
        properties: { b: coreId },
      }

      registry.register(schema1)
      registry.register(schema2)

      expect(schema1.properties?.['a']).toStrictEqual({ $ref: 'urn:test:core.Id' })
      expect(schema2.properties?.['b']).toStrictEqual({ $ref: 'urn:test:core.Id' })
      expect(registry.getCommonSchemas().size).toBe(1)
    })

    test('idempotent register — calling register twice does not double-process', () => {
      const coreId = makeCoreId()
      const schema: JSONSchema7 = {
        type: 'object',
        properties: { name: coreId },
      }

      registry.register(schema)
      registry.register(schema)

      expect(schema.properties?.['name']).toStrictEqual({ $ref: 'urn:test:core.Id' })
      expect(registry.getCommonSchemas().size).toBe(1)
    })

    test('getCommonSchemas excludes manually registered schemas', () => {
      const coreId = makeCoreId()
      const coreRev = makeCoreRev()

      // Register coreId directly (manually) — it should NOT appear in commonSchemas
      registry.register(coreId)

      // Register a schema that references coreRev — coreRev SHOULD appear
      const schema: JSONSchema7 = {
        type: 'object',
        properties: { rev: coreRev },
      }
      registry.register(schema)

      const common = registry.getCommonSchemas()
      expect(common.has('urn:test:core.Id')).toBe(false)
      expect(common.has('urn:test:core.Rev')).toBe(true)
    })
  })

  describe('int64 path hydration', () => {
    test('direct int64 — inline format int64 field, no $id', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          rev: { type: 'string', format: 'int64', pattern: '^[0-9]+$' },
        },
      }

      registry.register(schema)

      expectEnvelope(schema, ['.rev'])
    })

    test('$id boundary — property references CoreRev', () => {
      const coreRev = makeCoreRev()
      const schema: JSONSchema7 = {
        type: 'object',
        properties: { nextExpectedRevision: coreRev },
      }

      registry.register(schema)

      expectEnvelope(schema, ['.nextExpectedRevision'])
    })

    test('nested $id cascade — parent → CoreLink → CoreRev', () => {
      const coreId = makeCoreId()
      const coreRev = makeCoreRev()
      const coreLink = makeCoreLink(coreId, coreRev)

      const schema: JSONSchema7 = {
        type: 'object',
        properties: { link: coreLink },
      }

      registry.register(schema)

      // CoreRev paths = [''] (root IS int64)
      // CoreLink references CoreRev at .rev → paths = ['.rev']
      // Parent references CoreLink at .link → paths = ['.link.rev']
      expectEnvelope(schema, ['.link.rev'])
      expectEnvelope(coreLink, ['.rev'])
      expectEnvelope(coreRev, [''])
    })

    test('same $id schema used at two properties — both paths collected', () => {
      const coreRev = makeCoreRev()
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          rev1: coreRev,
          rev2: coreRev,
        },
      }

      registry.register(schema)

      expectEnvelope(schema, ['.rev1', '.rev2'])
    })

    test('array of $id schema — [] prefix applied', () => {
      const coreId = makeCoreId()
      const coreRev = makeCoreRev()
      const coreLink = makeCoreLink(coreId, coreRev)

      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          links: { type: 'array', items: coreLink },
        },
      }

      registry.register(schema)

      expectEnvelope(schema, ['.links[].rev'])
    })

    test('oneOf with int64 branch — only int64 branch adds path', () => {
      const coreRev = makeCoreRev()
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          revision: {
            anyOf: [{ type: 'string', const: 'latest' }, coreRev],
          },
        },
      }

      registry.register(schema)

      expectEnvelope(schema, ['.revision'])
    })

    test('deep nesting — object → array → object → int64', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nested: {
                  type: 'object',
                  properties: {
                    rev: { type: 'string', format: 'int64', pattern: '^[0-9]+$' },
                  },
                },
              },
            },
          },
        },
      }

      registry.register(schema)

      expectEnvelope(schema, ['.items[].nested.rev'])
    })

    test('pre-existing $ref — composes int64 paths from referenced schema', () => {
      const coreRev = makeCoreRev()

      // First register coreRev directly so it's known to AJV
      registry.register(coreRev)

      // Schema with a pre-existing $ref (not placed by the processor)
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          rev: { $ref: 'urn:test:core.Rev' },
        },
      }

      registry.register(schema)

      expectEnvelope(schema, ['.rev'])
    })

    test('pre-existing $ref to unregistered schema — asserts', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          rev: { $ref: 'urn:test:unknown' },
        },
      }

      expect(() => registry.register(schema)).toThrow(/unregistered schema/)
    })

    test('tuple items with int64 at specific index', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          pair: {
            type: 'array',
            items: [{ type: 'string' }, { type: 'string', format: 'int64', pattern: '^[0-9]+$' }],
          },
        },
      }

      registry.register(schema)

      expectEnvelope(schema, ['.pair[1]'])
    })

    test('tuple items with $id schemas', () => {
      const coreId = makeCoreId()
      const coreRev = makeCoreRev()
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          pair: { type: 'array', items: [coreId, coreRev] },
        },
      }

      registry.register(schema)

      expectEnvelope(schema, ['.pair[1]'])
      expect(schema.properties?.['pair']).toMatchObject({
        items: [{ $ref: 'urn:test:core.Id' }, { $ref: 'urn:test:core.Rev' }],
      })
    })
  })

  describe('additionalProperties int64', () => {
    test('direct int64 with properties — starMap excludes static keys', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          label: { type: 'string' },
        },
        additionalProperties: { type: 'string', format: 'int64', pattern: '^[0-9]+$' },
      }

      registry.register(schema)

      expectEnvelope(schema, ['.*'], { '.*': ['label'] })
    })

    test('direct int64 without properties — starMap empty', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        additionalProperties: { type: 'string', format: 'int64', pattern: '^[0-9]+$' },
      }

      registry.register(schema)

      expectEnvelope(schema, ['.*'])
    })

    test('$id int64 — starMap excludes static keys', () => {
      const coreRev = makeCoreRev()
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: coreRev,
      }

      registry.register(schema)

      expectEnvelope(schema, ['.*'], { '.*': ['name'] })
    })

    test('$ref to schema with inner int64 — paths through * and starMap', () => {
      const coreId = makeCoreId()
      const coreRev = makeCoreRev()
      const coreLink = makeCoreLink(coreId, coreRev)

      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          label: { type: 'string' },
        },
        additionalProperties: coreLink,
      }

      registry.register(schema)

      // CoreLink has int64 at .rev → composed with * prefix → .*.rev
      // Static keys from parent properties → starMap { '.*': ['label'] }
      expectEnvelope(schema, ['.*.rev'], { '.*': ['label'] })
    })

    test('$ref to schema with inner int64, no static properties — path only', () => {
      const coreId = makeCoreId()
      const coreRev = makeCoreRev()
      const coreLink = makeCoreLink(coreId, coreRev)

      const schema: JSONSchema7 = {
        type: 'object',
        additionalProperties: coreLink,
      }

      registry.register(schema)

      // No static properties → no starMap entry
      expectEnvelope(schema, ['.*.rev'])
    })

    test('inline object with inner int64 — paths through *', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: {
          type: 'object',
          properties: {
            count: { type: 'string', format: 'int64', pattern: '^[0-9]+$' },
            label: { type: 'string' },
          },
        },
      }

      registry.register(schema)

      expectEnvelope(schema, ['.*.count'], { '.*': ['name'] })
    })

    test('nested path — additionalProperties at non-root level', () => {
      const coreRev = makeCoreRev()
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          metadata: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              id: { type: 'string' },
            },
            additionalProperties: coreRev,
          },
        },
      }

      registry.register(schema)

      expectEnvelope(schema, ['.metadata.*'], { '.metadata.*': ['type', 'id'] })
    })

    test('nested path — additionalProperties with $ref containing int64', () => {
      const coreId = makeCoreId()
      const coreRev = makeCoreRev()
      const coreLink = makeCoreLink(coreId, coreRev)

      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          metadata: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              id: { type: 'string' },
            },
            additionalProperties: coreLink,
          },
        },
      }

      registry.register(schema)

      expectEnvelope(schema, ['.metadata.*.rev'], { '.metadata.*': ['type', 'id'] })
    })

    test('negative — object additionalProperties without int64', () => {
      const coreId = makeCoreId()
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          label: { type: 'string' },
        },
        additionalProperties: coreId,
      }

      registry.register(schema)

      expectEnvelope(schema, [])
    })

    test('negative — inline object additionalProperties without int64', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            count: { type: 'number' },
          },
        },
      }

      registry.register(schema)

      expectEnvelope(schema, [])
    })

    test('negative — boolean additionalProperties', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          rev: { type: 'string', format: 'int64', pattern: '^[0-9]+$' },
        },
        additionalProperties: true,
      }

      registry.register(schema)

      // Only the explicit property path, no star path
      expectEnvelope(schema, ['.rev'])
    })

    test('$id and $ref — both code paths with shared type', () => {
      const coreRev = makeCoreRev()

      // Schema A: additionalProperties is the coreRev object ($id branch)
      const schemaA: JSONSchema7 = {
        type: 'object',
        properties: { label: { type: 'string' } },
        additionalProperties: coreRev,
      }
      registry.register(schemaA)
      expectEnvelope(schemaA, ['.*'], { '.*': ['label'] })

      // Schema B: additionalProperties is a pre-existing $ref ($ref branch)
      const schemaB: JSONSchema7 = {
        type: 'object',
        properties: { name: { type: 'string' } },
        additionalProperties: { $ref: 'urn:test:core.Rev' },
      }
      registry.register(schemaB)
      expectEnvelope(schemaB, ['.*'], { '.*': ['name'] })
    })

    test('pre-existing $ref to manually registered type', () => {
      const coreRev = makeCoreRev()
      registry.register(coreRev)

      const schema: JSONSchema7 = {
        type: 'object',
        properties: { name: { type: 'string' } },
        additionalProperties: { $ref: 'urn:test:core.Rev' },
      }
      registry.register(schema)

      expectEnvelope(schema, ['.*'], { '.*': ['name'] })
    })

    test('shared $id instance in properties and additionalProperties', () => {
      const coreRev = makeCoreRev()
      const schema: JSONSchema7 = {
        type: 'object',
        properties: { rev: coreRev },
        additionalProperties: coreRev,
      }

      registry.register(schema)

      expectEnvelope(schema, ['.rev', '.*'], { '.*': ['rev'] })
    })

    test('shared inline int64 instance in properties and additionalProperties', () => {
      const int64Schema: JSONSchema7 = { type: 'string', format: 'int64', pattern: '^[0-9]+$' }
      const schema: JSONSchema7 = {
        type: 'object',
        properties: { rev: int64Schema },
        additionalProperties: int64Schema,
      }

      registry.register(schema)

      expectEnvelope(schema, ['.rev', '.*'], { '.*': ['rev'] })
    })
  })

  describe('multi-visitor', () => {
    test('multiple visitors produce independent envelopes in the plan', () => {
      const dateVisitor: SchemaVisitor = {
        name: 'date-time',
        match(schema: JSONSchema7): boolean {
          return schema.type === 'string' && schema.format === 'date-time'
        },
        hydrate(value: string): Date | undefined {
          const d = new Date(value)
          return isNaN(d.getTime()) ? undefined : d
        },
      }

      const multiRegistry = new SchemaRegistry(freshAjv(), [int64Visitor, dateVisitor])

      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          rev: { type: 'string', format: 'int64', pattern: '^[0-9]+$' },
          createdAt: { type: 'string', format: 'date-time' },
          name: { type: 'string' },
        },
      }

      multiRegistry.register(schema)

      const plan = multiRegistry.getHydrationPlan(schema)
      expect(plan.size).toBe(2)

      const int64Env = plan.get('int64')
      expect(int64Env).toBeDefined()
      expect(int64Env?.paths).toStrictEqual(['.rev'])

      const dateEnv = plan.get('date-time')
      expect(dateEnv).toBeDefined()
      expect(dateEnv?.paths).toStrictEqual(['.createdAt'])
    })

    test('hydrate applies all visitors', () => {
      const uppercaseVisitor: SchemaVisitor = {
        name: 'uppercase',
        match(schema: JSONSchema7): boolean {
          return schema.type === 'string' && schema.format === 'uppercase'
        },
        hydrate(value: string): string {
          return value.toUpperCase()
        },
      }

      const multiAjv = freshAjv()
      multiAjv.addFormat('uppercase', /.+/)
      const multiRegistry = new SchemaRegistry(multiAjv, [int64Visitor, uppercaseVisitor])

      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          rev: { type: 'string', format: 'int64', pattern: '^[0-9]+$' },
          label: { type: 'string', format: 'uppercase' },
        },
      }

      multiRegistry.register(schema)

      const data: Record<string, unknown> = { rev: '42', label: 'hello' }
      multiRegistry.hydrate(data, schema)

      expect(data.rev).toBe(42n)
      expect(data.label).toBe('HELLO')
    })
  })

  describe('hydrate', () => {
    test('no-op when schema is not registered', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          rev: { type: 'string', format: 'int64', pattern: '^[0-9]+$' },
        },
      }

      const data: Record<string, unknown> = { rev: '42' }
      registry.hydrate(data, schema)

      expect(data.rev).toBe('42')
    })

    test('end-to-end hydration through $id/$ref composed plans', () => {
      const coreId = makeCoreId()
      const coreRev = makeCoreRev()
      const coreLink = makeCoreLink(coreId, coreRev)

      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          rev: coreRev,
          link: coreLink,
          links: { type: 'array', items: coreLink },
        },
      }

      registry.register(schema)

      const data: Record<string, unknown> = {
        rev: '100',
        link: { type: 'Foo', id: 'abc', rev: '200' },
        links: [
          { type: 'Bar', id: 'def', rev: '300' },
          { type: 'Baz', id: 'ghi', rev: '400' },
        ],
      }
      registry.hydrate(data, schema)

      expect(data.rev).toBe(100n)
      expect((data.link as Record<string, unknown>).rev).toBe(200n)
      const links = data.links as Record<string, unknown>[]
      expect(links[0]?.rev).toBe(300n)
      expect(links[1]?.rev).toBe(400n)
    })

    test('empty visitors — register produces empty plan, hydrate is no-op', () => {
      const emptyRegistry = new SchemaRegistry(freshAjv(), [])

      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          rev: { type: 'string', format: 'int64', pattern: '^[0-9]+$' },
        },
      }

      emptyRegistry.register(schema)

      expect(emptyRegistry.getHydrationPlan(schema).size).toBe(0)

      const data: Record<string, unknown> = { rev: '42' }
      emptyRegistry.hydrate(data, schema)

      expect(data.rev).toBe('42')
    })
  })

  describe('compile validation', () => {
    test('compiled validator resolves $ref schemas', () => {
      const coreId = makeCoreId()
      const schema: JSONSchema7 = {
        type: 'object',
        properties: { name: coreId },
        required: ['name'],
        additionalProperties: false,
      }

      const validate = registry.compile(schema)

      expect(validate({ name: 'hello' })).toBe(true)
      expect(validate({ name: 42 })).toBe(false)
      expect(validate({})).toBe(false)
    })

    test('compiled validator rejects invalid data through nested $ref', () => {
      const coreId = makeCoreId()
      const coreRev = makeCoreRev()
      const coreLink = makeCoreLink(coreId, coreRev)

      const schema: JSONSchema7 = {
        type: 'object',
        properties: { link: coreLink },
        required: ['link'],
        additionalProperties: false,
      }

      const validate = registry.compile(schema)

      expect(validate({ link: { type: 'Foo', id: 'abc', rev: '42' } })).toBe(true)
      expect(validate({ link: { type: 'Foo', id: 'abc', rev: 'not-a-number' } })).toBe(false)
      expect(validate({ link: { type: 'Foo', id: 123, rev: '42' } })).toBe(false)
    })

    test('compiled validator works with combinator $ref', () => {
      const coreRev = makeCoreRev()
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          revision: { anyOf: [{ type: 'string', const: 'latest' }, coreRev] },
        },
        required: ['revision'],
        additionalProperties: false,
      }

      const validate = registry.compile(schema)

      expect(validate({ revision: 'latest' })).toBe(true)
      expect(validate({ revision: '42' })).toBe(true)
      expect(validate({ revision: 'abc' })).toBe(false)
    })

    test('compiled validator rejects empty string for int64 field', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          rev: { type: 'string', format: 'int64', pattern: '^[0-9]+$' },
        },
        required: ['rev'],
        additionalProperties: false,
      }

      const validate = registry.compile(schema)

      expect(validate({ rev: '42' })).toBe(true)
      expect(validate({ rev: '' })).toBe(false)
    })

    test('compiled validator works with additionalProperties $ref', () => {
      const coreId = makeCoreId()
      const schema: JSONSchema7 = {
        type: 'object',
        additionalProperties: coreId,
      }

      const validate = registry.compile(schema)

      expect(validate({ foo: 'bar', baz: 'qux' })).toBe(true)
      expect(validate({ foo: 42 })).toBe(false)
    })
  })

  function makeCoreId(): JSONSchema7 {
    return { $id: 'urn:test:core.Id', type: 'string' }
  }

  function makeCoreRev(): JSONSchema7 {
    return { $id: 'urn:test:core.Rev', type: 'string', format: 'int64', pattern: '^[0-9]+$' }
  }

  function makeCoreLink(coreId: JSONSchema7, coreRev: JSONSchema7): JSONSchema7 {
    return {
      $id: 'urn:test:core.Link',
      type: 'object',
      properties: {
        type: { type: 'string' },
        id: coreId,
        rev: coreRev,
      },
      required: ['type', 'id', 'rev'],
      additionalProperties: false,
    }
  }

  function makeCoreDict(coreId: JSONSchema7): JSONSchema7 {
    return {
      $id: 'urn:test:core.Dict',
      type: 'object',
      additionalProperties: coreId,
    }
  }

  // --- helpers ---

  function freshAjv(): Ajv {
    const instance = new Ajv({ allErrors: true })
    const addFormats = formatsModule as unknown as (ajv: Ajv, options?: FormatsPluginOptions) => Ajv
    addFormats(instance)
    instance.addFormat('int64', /^[0-9]+$/)
    return instance
  }

  function expectEnvelope(
    schema: JSONSchema7,
    paths: string[],
    starMap: Record<string, string[]> = {},
  ): void {
    const plan = registry.getHydrationPlan(schema)
    const envelope: HydrationEnvelope | undefined = plan.get('int64')
    if (paths.length === 0) {
      // Either no plan entry or empty paths
      if (envelope) {
        expect(envelope.paths).toStrictEqual([])
      } else {
        expect(plan.has('int64')).toBe(false)
      }
      return
    }
    expect(envelope).toBeDefined()
    expect(envelope?.paths).toStrictEqual(paths)
    expect(envelope?.starMap).toBeDefined()
    if (!envelope?.starMap) return
    expect(Object.fromEntries(envelope.starMap)).toStrictEqual(starMap)
  }
})
