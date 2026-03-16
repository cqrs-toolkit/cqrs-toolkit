import type { JSONSchema7 } from 'json-schema'
import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { HydraDoc } from '../HydraDoc.js'
import { makeClassDef, PREFIXES, RENAME_SCHEMA } from './builder.fixtures.js'
import { buildHydraApiDocumentation, type BuildResult } from './HydraBuilder.js'
import { resolveSchemaBundle, urnToSchemaUrl, urnToVocabUrl } from './resolve.js'

const DOCS_ENTRYPOINT = 'https://example.com/api/meta'
const API_ENTRYPOINT = 'https://example.com/api'

const SHARED_SUB_SCHEMA: JSONSchema7 = {
  $id: 'urn:schema:test.SharedId:1.0.0',
  type: 'string',
  format: 'uuid',
}

describe('resolve', () => {
  describe('urnToSchemaUrl', () => {
    it('converts a URN to a dereferenceable URL', () => {
      expect(urnToSchemaUrl('/api/meta', 'urn:command:test.Foo:1.0.0')).toBe(
        '/api/meta/schemas/urn/command/test.Foo/1.0.0.json',
      )
    })

    it('works with a full base URL', () => {
      expect(urnToSchemaUrl(DOCS_ENTRYPOINT, 'urn:schema:test.Bar:2.0.0')).toBe(
        `${DOCS_ENTRYPOINT}/schemas/urn/schema/test.Bar/2.0.0.json`,
      )
    })
  })

  describe('urnToVocabUrl', () => {
    it('converts a vocab URN to a dereferenceable URL', () => {
      expect(urnToVocabUrl(DOCS_ENTRYPOINT, 'urn:vocab:chat#')).toBe(
        `${DOCS_ENTRYPOINT}/vocab/chat#`,
      )
    })
  })

  describe('resolveSchemaBundle', () => {
    it('rewrites svc:jsonSchema URNs in apidoc to URLs', () => {
      const result = buildSimple()
      const bundle = resolveSchemaBundle({
        buildResult: result,
        docsEntrypoint: DOCS_ENTRYPOINT,
        apiEntrypoint: API_ENTRYPOINT,
      })

      const apidoc = JSON.parse(bundle.apidoc.content)
      const cmd = findCommand(apidoc, 'urn:command:test.RenameItem:1.0.0')
      expect(cmd['svc:jsonSchema']).toBe(
        `${DOCS_ENTRYPOINT}/schemas/urn/schema/test.RenameItem/1.0.0.json`,
      )
    })

    it('rewrites $ref URNs in command schemas to URLs', () => {
      const result = buildWithSharedSchema()
      const bundle = resolveSchemaBundle({
        buildResult: result,
        docsEntrypoint: DOCS_ENTRYPOINT,
        apiEntrypoint: API_ENTRYPOINT,
      })

      const schemaPath = 'schemas/urn/schema/test.RenameItem/1.0.0.json'
      const schemaContent = bundle.schemas.get(schemaPath)
      expect(schemaContent).toBeDefined()

      const parsed = JSON.parse(schemaContent!)
      expect(parsed.properties.targetId.$ref).toBe(
        `${DOCS_ENTRYPOINT}/schemas/urn/schema/test.SharedId/1.0.0.json`,
      )
    })

    it('rewrites $id URNs in common schemas to URLs', () => {
      const result = buildWithSharedSchema()
      const bundle = resolveSchemaBundle({
        buildResult: result,
        docsEntrypoint: DOCS_ENTRYPOINT,
        apiEntrypoint: API_ENTRYPOINT,
      })

      const commonPath = 'schemas/urn/schema/test.SharedId/1.0.0.json'
      const content = bundle.schemas.get(commonPath)
      expect(content).toBeDefined()

      const parsed = JSON.parse(content!)
      expect(parsed.$id).toBe(`${DOCS_ENTRYPOINT}/schemas/urn/schema/test.SharedId/1.0.0.json`)
    })

    it('includes both command and common schemas in resolved map', () => {
      const result = buildWithSharedSchema()
      const bundle = resolveSchemaBundle({
        buildResult: result,
        docsEntrypoint: DOCS_ENTRYPOINT,
        apiEntrypoint: API_ENTRYPOINT,
      })

      expect(bundle.schemas.has('schemas/urn/schema/test.RenameItem/1.0.0.json')).toBe(true)
      expect(bundle.schemas.has('schemas/urn/schema/test.SharedId/1.0.0.json')).toBe(true)
    })

    it('produces compact apidoc content (no indentation)', () => {
      const result = buildSimple()
      const bundle = resolveSchemaBundle({
        buildResult: result,
        docsEntrypoint: DOCS_ENTRYPOINT,
        apiEntrypoint: API_ENTRYPOINT,
      })

      expect(bundle.apidoc.content).not.toContain('\n')
    })

    it('produces apidoc content with sorted keys', () => {
      const result = buildSimple()
      const bundle = resolveSchemaBundle({
        buildResult: result,
        docsEntrypoint: DOCS_ENTRYPOINT,
        apiEntrypoint: API_ENTRYPOINT,
      })

      const parsed = JSON.parse(bundle.apidoc.content)
      const keys = Object.keys(parsed)
      expect(keys).toEqual([...keys].sort())
    })

    it('computes ETag as SHA-256 hex of compact content', () => {
      const result = buildSimple()
      const bundle = resolveSchemaBundle({
        buildResult: result,
        docsEntrypoint: DOCS_ENTRYPOINT,
        apiEntrypoint: API_ENTRYPOINT,
      })

      const expected = crypto.createHash('sha256').update(bundle.apidoc.content).digest('hex')
      expect(bundle.apidoc.etag).toBe(expected)
    })

    it('resolves vocab prefix URNs in @context to URLs', () => {
      const result = buildSimple()
      const bundle = resolveSchemaBundle({
        buildResult: result,
        docsEntrypoint: DOCS_ENTRYPOINT,
        apiEntrypoint: API_ENTRYPOINT,
      })

      const apidoc = JSON.parse(bundle.apidoc.content)
      const ctx = apidoc['@context']
      expect(ctx.test).toBe(`${DOCS_ENTRYPOINT}/vocab/test#`)
      expect(ctx.svc).toBe(`${DOCS_ENTRYPOINT}/vocab/svc#`)
      // builtins should not be transformed
      expect(ctx.hydra).toBe('http://www.w3.org/ns/hydra/core#')
    })

    it('resolves urn:apidoc @id to docsEntrypoint URL', () => {
      const result = buildSimple()
      const bundle = resolveSchemaBundle({
        buildResult: result,
        docsEntrypoint: DOCS_ENTRYPOINT,
        apiEntrypoint: API_ENTRYPOINT,
      })

      const apidoc = JSON.parse(bundle.apidoc.content)
      expect(apidoc['@id']).toBe(`${DOCS_ENTRYPOINT}/apidoc`)
    })

    it('resolves urn:entrypoint to apiEntrypoint URL', () => {
      const result = buildSimple()
      const bundle = resolveSchemaBundle({
        buildResult: result,
        docsEntrypoint: DOCS_ENTRYPOINT,
        apiEntrypoint: API_ENTRYPOINT,
      })

      const apidoc = JSON.parse(bundle.apidoc.content)
      expect(apidoc['hydra:entrypoint']['@id']).toBe(API_ENTRYPOINT)
    })

    it('leaves non-URN $ref values unchanged', () => {
      // Build a minimal BuildResult with a schema containing a non-URN $ref,
      // bypassing the builder to avoid SchemaRegistry validation.
      const result = buildSimple()
      const schemaWithLocalRef: JSONSchema7 = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/$defs/Item' },
          },
        },
        $defs: {
          Item: { type: 'object', properties: { name: { type: 'string' } } },
        },
      }
      // Inject directly into the schemas map
      result.schemas.set('schemas/urn/command/test.LocalRef/1.0.0.json', {
        content: JSON.stringify(schemaWithLocalRef, null, 2),
        isLatest: true,
      })

      const bundle = resolveSchemaBundle({
        buildResult: result,
        docsEntrypoint: DOCS_ENTRYPOINT,
        apiEntrypoint: API_ENTRYPOINT,
      })

      const schemaPath = 'schemas/urn/command/test.LocalRef/1.0.0.json'
      const parsed = JSON.parse(bundle.schemas.get(schemaPath)!)
      expect(parsed.properties.items.items.$ref).toBe('#/$defs/Item')
    })
  })
})

function buildSimple(): BuildResult {
  return buildHydraApiDocumentation({
    classes: [
      makeClassDef({
        surfaces: HydraDoc.standardCommandSurfaces({
          idStem: '#test',
          collectionHref: '/api/test/entities',
          idProperty: 'test:entityId',
        }),
        commands: [
          {
            id: 'urn:command:test.RenameItem:1.0.0',
            stableId: 'test.RenameItem',
            dispatch: 'command',
            commandType: 'rename',
            schema: RENAME_SCHEMA,
          },
        ],
      }),
    ],
    prefixes: PREFIXES,
    strictPrefixes: true,
  })
}

function buildWithSharedSchema(): BuildResult {
  const schema: JSONSchema7 = {
    $id: 'urn:schema:test.RenameItem:1.0.0',
    type: 'object',
    properties: {
      targetId: { ...SHARED_SUB_SCHEMA },
    },
    required: ['targetId'],
    additionalProperties: false,
  }
  return buildWithCustomSchema(schema)
}

function buildWithCustomSchema(schema: JSONSchema7): BuildResult {
  return buildHydraApiDocumentation({
    classes: [
      makeClassDef({
        surfaces: HydraDoc.standardCommandSurfaces({
          idStem: '#test',
          collectionHref: '/api/test/entities',
          idProperty: 'test:entityId',
        }),
        commands: [
          {
            id: 'urn:command:test.RenameItem:1.0.0',
            stableId: 'test.RenameItem',
            dispatch: 'command',
            commandType: 'rename',
            schema,
          },
        ],
      }),
    ],
    prefixes: PREFIXES,
    strictPrefixes: true,
  })
}

function findCommand(apidoc: Record<string, unknown>, commandId: string): Record<string, unknown> {
  const classes = apidoc['hydra:supportedClass'] as Record<string, unknown>[]
  for (const cls of classes) {
    const cmds = (cls['svc:commands'] as Record<string, unknown>)?.['svc:supportedCommand'] as
      | Record<string, unknown>[]
      | undefined
    if (!cmds) continue
    for (const cmd of cmds) {
      if (cmd['@id'] === commandId) return cmd
    }
  }
  throw new Error(`Command ${commandId} not found in apidoc`)
}
