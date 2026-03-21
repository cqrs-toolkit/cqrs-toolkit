import type { JSONSchema7 } from 'json-schema'
import { describe, expect, it } from 'vitest'
import { HydraDoc } from '../HydraDoc.js'
import { makeClassDef, minimalRepresentation, PREFIXES, RENAME_SCHEMA } from './builder.fixtures.js'
import { buildHydraApiDocumentation, type BuildResult } from './HydraBuilder.js'

const CREATE_SCHEMA: JSONSchema7 = {
  $id: 'urn:schema:test.CreateItem:1.0.0',
  type: 'object',
  properties: { name: { type: 'string' } },
  required: ['name'],
  additionalProperties: false,
}

const RENAME_SCHEMA_V2: JSONSchema7 = {
  $id: 'urn:schema:test.RenameItem:2.0.0',
  type: 'object',
  properties: { name: { type: 'string' } },
  required: ['name'],
  additionalProperties: false,
}

describe('buildHydraApiDocumentation', () => {
  describe('placeholder URNs', () => {
    it('uses urn:apidoc as the @id placeholder', () => {
      const result = buildWithSchema()
      expect(result.jsonld['@id']).toBe('urn:apidoc')
    })

    it('uses urn:entrypoint as the hydra:entrypoint placeholder', () => {
      const result = buildWithSchema()
      expect(result.jsonld['hydra:entrypoint']).toEqual({ '@id': 'urn:entrypoint' })
    })
  })

  describe('command identity', () => {
    it('renders svc:stableId on command capabilities', () => {
      const result = buildWithSchema()
      const cmd = findCommand(result, 'urn:command:test.RenameItem:1.0.0')
      expect(cmd['svc:stableId']).toBe('test.RenameItem')
    })

    it('renders schema:version on command capabilities', () => {
      const result = buildWithSchema()
      const cmd = findCommand(result, 'urn:command:test.RenameItem:1.0.0')
      expect(cmd['schema:version']).toBe('1.0.0')
    })

    it('renders correct version for each command in a multi-version group', () => {
      const result = buildMultiVersion()
      const v1 = findCommand(result, 'urn:command:test.RenameItem:1.0.0')
      const v2 = findCommand(result, 'urn:command:test.RenameItem:2.0.0')
      expect(v1['svc:stableId']).toBe('test.RenameItem')
      expect(v1['schema:version']).toBe('1.0.0')
      expect(v2['svc:stableId']).toBe('test.RenameItem')
      expect(v2['schema:version']).toBe('2.0.0')
    })

    it('includes svc:stableId context entry', () => {
      const result = buildWithSchema()
      const ctx = result.jsonld['@context']
      expect(ctx['svc:stableId']).toEqual({})
    })
  })

  describe('schema output', () => {
    it('produces svc:jsonSchema IRI for commands with schema', () => {
      const result = buildWithSchema()
      const cmd = findCommand(result, 'urn:command:test.RenameItem:1.0.0')
      expect(cmd['svc:jsonSchema']).toBe('urn:schema:test.RenameItem:1.0.0')
    })

    it('omits svc:jsonSchema for commands without schema', () => {
      const result = buildWithoutSchema()
      const cmd = findCommand(result, 'urn:command:test.RenameItem:1.0.0')
      expect(cmd).not.toHaveProperty('svc:jsonSchema')
    })

    it('includes svc:jsonSchema context entry as { @type: @id }', () => {
      const result = buildWithSchema()
      const ctx = result.jsonld['@context']
      expect(ctx['svc:jsonSchema']).toEqual({ '@type': '@id' })
    })

    it('populates schemas map with correct relative paths and content', () => {
      const result = buildWithSchema()
      expect(result.schemas.size).toBe(2)

      const renamePath = 'schemas/urn/schema/test.RenameItem/1.0.0.json'
      const renameEntry = result.schemas.get(renamePath)
      expect(renameEntry).toBeDefined()
      expect(JSON.parse(renameEntry!.content)).toEqual(RENAME_SCHEMA)

      const createPath = 'schemas/urn/schema/test.CreateItem/1.0.0.json'
      const createEntry = result.schemas.get(createPath)
      expect(createEntry).toBeDefined()
      expect(JSON.parse(createEntry!.content)).toEqual(CREATE_SCHEMA)
    })

    it('sets isLatest correctly on schema entries', () => {
      const result = buildMultiVersion()

      const v1Path = 'schemas/urn/schema/test.RenameItem/1.0.0.json'
      const v2Path = 'schemas/urn/schema/test.RenameItem/2.0.0.json'

      expect(result.schemas.get(v1Path)?.isLatest).toBe(false)
      expect(result.schemas.get(v2Path)?.isLatest).toBe(true)
    })

    it('returns empty schemas map when no commands have schemas', () => {
      const result = buildWithoutSchema()
      expect(result.schemas.size).toBe(0)
    })

    it('allows shared schema instances across commands without warning', () => {
      const result = buildWithCollision()
      expect(result.warnings).toEqual([])
      // Only one schema entry since it's the same object
      expect(result.schemas.size).toBe(1)
    })

    it('warns on schema path collision from different instances', () => {
      const result = buildWithCollisionDifferentInstances()
      expect(result.warnings.some((w) => w.includes('Schema path collision'))).toBe(true)
      expect(result.schemas.size).toBe(1)
    })
  })

  describe('schema normalization', () => {
    const SHARED_SUB_SCHEMA: JSONSchema7 = {
      $id: 'urn:schema:test.SharedId:1.0.0',
      type: 'string',
      format: 'uuid',
    }

    it('replaces inline $id sub-schemas with $ref in command schemas', () => {
      const schema: JSONSchema7 = {
        $id: 'urn:schema:test.RenameItem:1.0.0',
        type: 'object',
        properties: {
          targetId: { ...SHARED_SUB_SCHEMA },
        },
        required: ['targetId'],
        additionalProperties: false,
      }
      const result = buildWithCustomSchema(schema)

      const schemaPath = 'schemas/urn/schema/test.RenameItem/1.0.0.json'
      const entry = result.schemas.get(schemaPath)
      expect(entry).toBeDefined()
      const parsed = JSON.parse(entry!.content)
      expect(parsed.properties.targetId).toEqual({ $ref: 'urn:schema:test.SharedId:1.0.0' })
    })

    it('merges auto-discovered $id sub-schemas into schemas map', () => {
      const schema: JSONSchema7 = {
        $id: 'urn:schema:test.RenameItem:1.0.0',
        type: 'object',
        properties: {
          targetId: { ...SHARED_SUB_SCHEMA },
        },
        required: ['targetId'],
        additionalProperties: false,
      }
      const result = buildWithCustomSchema(schema)

      const commonPath = 'schemas/urn/schema/test.SharedId/1.0.0.json'
      const commonEntry = result.schemas.get(commonPath)
      expect(commonEntry).toBeDefined()
      const parsed = JSON.parse(commonEntry!.content)
      expect(parsed.$id).toBe('urn:schema:test.SharedId:1.0.0')
      expect(parsed.type).toBe('string')
    })

    it('throws when command schema is missing $id', () => {
      const schemaWithoutId: JSONSchema7 = {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
        additionalProperties: false,
      }
      expect(() =>
        buildHydraApiDocumentation({
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
                  version: '1.0.0',
                  dispatch: 'command',
                  commandType: 'rename',
                  schema: schemaWithoutId,
                },
              ],
            }),
          ],
          prefixes: PREFIXES,
          strictPrefixes: true,
        }),
      ).toThrow('Missing required $id')
    })
  })
})

function buildWithSchema(): BuildResult {
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
            version: '1.0.0',
            dispatch: 'command',
            commandType: 'rename',
            schema: RENAME_SCHEMA,
          },
          {
            id: 'urn:command:test.CreateItem:1.0.0',
            stableId: 'test.CreateItem',
            version: '1.0.0',
            dispatch: 'create',
            schema: CREATE_SCHEMA,
          },
        ],
      }),
    ],

    prefixes: PREFIXES,
    strictPrefixes: true,
  })
}

function buildWithoutSchema(): BuildResult {
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
            version: '1.0.0',
            dispatch: 'command',
            commandType: 'rename',
            // no schema
          },
        ],
      }),
    ],

    prefixes: PREFIXES,
    strictPrefixes: true,
  })
}

function buildMultiVersion(): BuildResult {
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
            version: '1.0.0',
            dispatch: 'command',
            commandType: 'rename',
            schema: RENAME_SCHEMA,
            adapt: (data: unknown) => data,
          },
          {
            id: 'urn:command:test.RenameItem:2.0.0',
            stableId: 'test.RenameItem',
            version: '2.0.0',
            dispatch: 'command',
            commandType: 'rename',
            schema: RENAME_SCHEMA_V2,
          },
        ],
      }),
    ],

    prefixes: PREFIXES,
    strictPrefixes: true,
  })
}

function buildWithCollision(): BuildResult {
  // Two different classes with commands whose schemas share the same $id
  return buildHydraApiDocumentation({
    classes: [
      {
        class: 'test:Entity',
        commands: new HydraDoc.CommandsDef({
          surfaces: HydraDoc.standardCommandSurfaces({
            idStem: '#test',
            collectionHref: '/api/test/entities',
            idProperty: 'test:entityId',
          }),
          commands: [
            {
              id: 'urn:command:test.RenameItem:1.0.0',
              stableId: 'test.RenameItem',
              version: '1.0.0',
              dispatch: 'command',
              commandType: 'rename',
              schema: RENAME_SCHEMA,
            },
          ],
        }),
        representations: [minimalRepresentation()],
      },
      {
        class: 'test:Thing',
        commands: new HydraDoc.CommandsDef({
          surfaces: HydraDoc.standardCommandSurfaces({
            idStem: '#test2',
            collectionHref: '/api/test/things',
            idProperty: 'test:thingId',
          }),
          commands: [
            {
              id: 'urn:command:test.RenameThing:1.0.0',
              stableId: 'test.RenameThing',
              version: '1.0.0',
              dispatch: 'command',
              commandType: 'rename',
              schema: RENAME_SCHEMA,
            },
          ],
        }),
        representations: [
          new HydraDoc.Representation({
            id: '#test-thing-v1_0_0',
            version: '1.0.0',
            resource: {
              profile: 'urn:profile:test.Thing:1.0.0',
              formats: ['application/json'],
              template: {
                id: '#test-thing-resource-v1_0_0',
                template: '/api/test/things/{id}',
                mappings: [{ variable: 'id', property: 'test:thingId', required: true }],
              },
            },
            collection: {
              profile: 'urn:profile:test.ThingCollection:1.0.0',
              formats: ['application/json'],
              href: '/api/test/things',
              template: {
                id: '#test-thing-collection-v1_0_0',
                template: '/api/test/things',
                mappings: [{ variable: 'q', property: 'svc:query' }],
              },
            },
          }),
        ],
      },
    ],

    prefixes: PREFIXES,
    strictPrefixes: true,
  })
}

function buildWithCollisionDifferentInstances(): BuildResult {
  // Two different schema objects that happen to share the same $id — a real collision
  const schemaA: JSONSchema7 = { ...RENAME_SCHEMA }
  const schemaB: JSONSchema7 = { ...RENAME_SCHEMA }
  return buildHydraApiDocumentation({
    classes: [
      {
        class: 'test:Entity',
        commands: new HydraDoc.CommandsDef({
          surfaces: HydraDoc.standardCommandSurfaces({
            idStem: '#test',
            collectionHref: '/api/test/entities',
            idProperty: 'test:entityId',
          }),
          commands: [
            {
              id: 'urn:command:test.RenameItem:1.0.0',
              stableId: 'test.RenameItem',
              version: '1.0.0',
              dispatch: 'command',
              commandType: 'rename',
              schema: schemaA,
            },
          ],
        }),
        representations: [minimalRepresentation()],
      },
      {
        class: 'test:Thing',
        commands: new HydraDoc.CommandsDef({
          surfaces: HydraDoc.standardCommandSurfaces({
            idStem: '#test2',
            collectionHref: '/api/test/things',
            idProperty: 'test:thingId',
          }),
          commands: [
            {
              id: 'urn:command:test.RenameThing:1.0.0',
              stableId: 'test.RenameThing',
              version: '1.0.0',
              dispatch: 'command',
              commandType: 'rename',
              schema: schemaB,
            },
          ],
        }),
        representations: [
          new HydraDoc.Representation({
            id: '#test-thing-v1_0_0',
            version: '1.0.0',
            resource: {
              profile: 'urn:profile:test.Thing:1.0.0',
              formats: ['application/json'],
              template: {
                id: '#test-thing-resource-v1_0_0',
                template: '/api/test/things/{id}',
                mappings: [{ variable: 'id', property: 'test:thingId', required: true }],
              },
            },
            collection: {
              profile: 'urn:profile:test.ThingCollection:1.0.0',
              formats: ['application/json'],
              href: '/api/test/things',
              template: {
                id: '#test-thing-collection-v1_0_0',
                template: '/api/test/things',
                mappings: [{ variable: 'q', property: 'svc:query' }],
              },
            },
          }),
        ],
      },
    ],
    prefixes: PREFIXES,
    strictPrefixes: true,
  })
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
            version: '1.0.0',
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

function findCommand(result: BuildResult, commandId: string): Record<string, any> {
  const classes = result.jsonld['hydra:supportedClass'] as any[]
  for (const cls of classes) {
    const cmds = cls['svc:commands']?.['svc:supportedCommand']
    if (!cmds) continue
    for (const cmd of cmds) {
      if (cmd['@id'] === commandId) return cmd
    }
  }
  throw new Error(`Command ${commandId} not found in JSON-LD output`)
}
