import type { JSONSchema7 } from 'json-schema'
import { describe, expect, it } from 'vitest'
import { HydraDoc } from '../HydraDoc.js'
import {
  makeClassDef,
  minimalRepresentation,
  PERMIT_RESPONSE_SCHEMA,
  PREFIXES,
  RENAME_SCHEMA,
} from './builder.fixtures.js'
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

  describe('response schemas', () => {
    it('renders svc:responseSchema on command capabilities', () => {
      const result = buildWithResponseSchema()
      const cmd = findCommand(result, 'urn:command:test.CreateItem:1.0.0')
      const responseSchema = cmd['svc:responseSchema']
      expect(responseSchema).toBeDefined()
      expect(responseSchema).toHaveLength(1)
      expect(responseSchema[0]['@type']).toBe('svc:ContentTypeSchema')
      expect(responseSchema[0]['svc:contentType']).toBe('application/json')
      expect(responseSchema[0]['svc:jsonSchema']).toBe('urn:schema:test.PermitResponse:1.0.0')
    })

    it('omits svc:responseSchema when not provided', () => {
      const result = buildWithSchema()
      const cmd = findCommand(result, 'urn:command:test.RenameItem:1.0.0')
      expect(cmd).not.toHaveProperty('svc:responseSchema')
    })

    it('collects response schemas into schemas map alongside request schemas', () => {
      const result = buildWithResponseSchema()
      const permitPath = 'schemas/urn/schema/test.PermitResponse/1.0.0.json'
      const permitEntry = result.schemas.get(permitPath)
      expect(permitEntry).toBeDefined()
      expect(JSON.parse(permitEntry!.content).$id).toBe('urn:schema:test.PermitResponse:1.0.0')

      // Request schema is also present
      const createPath = 'schemas/urn/schema/test.CreateItem/1.0.0.json'
      expect(result.schemas.has(createPath)).toBe(true)
    })

    it('renders svc:responseSchema on representation surfaces', () => {
      const responseSchema: JSONSchema7 = {
        $id: 'urn:schema:test.EntityResponse:1.0.0',
        type: 'object',
        properties: { id: { type: 'string' } },
      }
      const result = buildHydraApiDocumentation({
        classes: [
          {
            class: 'test:Entity',
            representations: [
              new HydraDoc.Representation({
                id: '#test-entity-v1_0_0',
                version: '1.0.0',
                resource: {
                  profile: 'urn:profile:test.Entity:1.0.0',
                  formats: ['application/json'],
                  template: {
                    id: '#test-entity-resource-v1_0_0',
                    template: '/api/test/entities/{id}',
                    mappings: [{ variable: 'id', property: 'test:entityId', required: true }],
                  },
                  responses: [{ code: 200, schema: responseSchema }],
                },
                collection: {
                  profile: 'urn:profile:test.EntityCollection:1.0.0',
                  formats: ['application/json'],
                  href: '/api/test/entities',
                  template: {
                    id: '#test-entity-collection-v1_0_0',
                    template: '/api/test/entities',
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

      const cls = result.jsonld['hydra:supportedClass'][0]
      const rep = cls['svc:representation'][0]
      const resourceResponseSchema = rep['svc:resource']['svc:responseSchema']
      expect(resourceResponseSchema).toBeDefined()
      expect(resourceResponseSchema).toHaveLength(1)
      expect(resourceResponseSchema[0]['svc:contentType']).toBe('application/json')
      expect(resourceResponseSchema[0]['svc:jsonSchema']).toBe(
        'urn:schema:test.EntityResponse:1.0.0',
      )

      // Collection should not have responseSchema (not provided)
      expect(rep['svc:collection']).not.toHaveProperty('svc:responseSchema')

      // Schema should be in the schemas map
      const schemaPath = 'schemas/urn/schema/test.EntityResponse/1.0.0.json'
      expect(result.schemas.has(schemaPath)).toBe(true)
    })

    it('extracts shared sub-schemas across request and response schemas', () => {
      // Same object reference in both schemas — this is how shared sub-schemas work in practice.
      // SchemaRegistry mutates inline $id sub-schemas to $ref pointers, so both parents
      // must reference the same object for the dedup to work correctly.
      const sharedSubSchema: JSONSchema7 = {
        $id: 'urn:schema:test.SharedId:1.0.0',
        type: 'string',
        format: 'uuid',
      }
      const requestSchema: JSONSchema7 = {
        $id: 'urn:schema:test.CreateItem:1.0.0',
        type: 'object',
        properties: { targetId: sharedSubSchema },
        required: ['targetId'],
        additionalProperties: false,
      }
      const responseSchema: JSONSchema7 = {
        $id: 'urn:schema:test.CreateItemResponse:1.0.0',
        type: 'object',
        properties: { createdId: sharedSubSchema },
        required: ['createdId'],
      }

      const result = buildHydraApiDocumentation({
        classes: [
          makeClassDef({
            surfaces: HydraDoc.standardCommandSurfaces({
              idStem: '#test',
              collectionHref: '/api/test/entities',
              idProperty: 'test:entityId',
            }),
            commands: [
              {
                id: 'urn:command:test.CreateItem:1.0.0',
                stableId: 'test.CreateItem',
                version: '1.0.0',
                dispatch: 'create',
                schema: requestSchema,
                responses: [{ code: 200, schema: responseSchema }],
              },
            ],
          }),
        ],
        prefixes: PREFIXES,
        strictPrefixes: true,
      })

      // Shared sub-schema appears once
      const commonPath = 'schemas/urn/schema/test.SharedId/1.0.0.json'
      expect(result.schemas.has(commonPath)).toBe(true)

      // Request schema has $ref, not inline
      const reqPath = 'schemas/urn/schema/test.CreateItem/1.0.0.json'
      const reqParsed = JSON.parse(result.schemas.get(reqPath)!.content)
      expect(reqParsed.properties.targetId).toEqual({ $ref: 'urn:schema:test.SharedId:1.0.0' })

      // Response schema has $ref, not inline
      const resPath = 'schemas/urn/schema/test.CreateItemResponse/1.0.0.json'
      const resParsed = JSON.parse(result.schemas.get(resPath)!.content)
      expect(resParsed.properties.createdId).toEqual({ $ref: 'urn:schema:test.SharedId:1.0.0' })
    })

    it('includes context entries for response schema terms', () => {
      const result = buildWithResponseSchema()
      const ctx = result.jsonld['@context']
      expect(ctx['svc:responseSchema']).toEqual({ '@container': '@set' })
      expect(ctx['svc:contentType']).toEqual({})
    })
  })

  describe('workflow', () => {
    it('renders svc:workflow with nextStep on command capabilities', () => {
      const result = buildWithWorkflow()
      const cmd = findCommand(result, 'urn:command:test.CreateItem:1.0.0')
      const workflow = cmd['svc:workflow']
      expect(workflow).toBeDefined()
      expect(workflow['@type']).toBe('svc:PresignedPostUpload')

      const nextStep = workflow['svc:nextStep']
      expect(nextStep).toBeDefined()
      expect(nextStep['@id']).toBe('svc:S3FormPost')
      expect(nextStep['@type']).toBe('svc:ExternalEndpoint')

      const ops = nextStep['hydra:supportedOperation']
      expect(ops).toHaveLength(1)
      expect(ops[0]['@type']).toBe('hydra:Operation')
      expect(ops[0]['hydra:method']).toBe('POST')
      expect(ops[0]['hydra:expects']).toBe('multipart/form-data')
    })

    it('renders workflow without nextStep', () => {
      const result = buildHydraApiDocumentation({
        classes: [
          makeClassDef({
            surfaces: HydraDoc.standardCommandSurfaces({
              idStem: '#test',
              collectionHref: '/api/test/entities',
              idProperty: 'test:entityId',
            }),
            commands: [
              {
                id: 'urn:command:test.CreateItem:1.0.0',
                stableId: 'test.CreateItem',
                version: '1.0.0',
                dispatch: 'create',
                schema: CREATE_SCHEMA,
                workflow: { type: 'svc:PresignedPostUpload' },
              },
            ],
          }),
        ],
        prefixes: PREFIXES,
        strictPrefixes: true,
      })
      const cmd = findCommand(result, 'urn:command:test.CreateItem:1.0.0')
      const workflow = cmd['svc:workflow']
      expect(workflow['@type']).toBe('svc:PresignedPostUpload')
      expect(workflow).not.toHaveProperty('svc:nextStep')
    })

    it('omits svc:workflow when not provided', () => {
      const result = buildWithSchema()
      const cmd = findCommand(result, 'urn:command:test.RenameItem:1.0.0')
      expect(cmd).not.toHaveProperty('svc:workflow')
    })

    it('includes workflow context entries', () => {
      const result = buildWithWorkflow()
      const ctx = result.jsonld['@context']
      expect(ctx['svc:workflow']).toEqual({})
      expect(ctx['svc:nextStep']).toEqual({})
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

function buildWithResponseSchema(): BuildResult {
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
            id: 'urn:command:test.CreateItem:1.0.0',
            stableId: 'test.CreateItem',
            version: '1.0.0',
            dispatch: 'create',
            schema: CREATE_SCHEMA,
            responses: [{ code: 200, schema: PERMIT_RESPONSE_SCHEMA }],
          },
        ],
      }),
    ],
    prefixes: PREFIXES,
    strictPrefixes: true,
  })
}

function buildWithWorkflow(): BuildResult {
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
            id: 'urn:command:test.CreateItem:1.0.0',
            stableId: 'test.CreateItem',
            version: '1.0.0',
            dispatch: 'create',
            schema: CREATE_SCHEMA,
            workflow: {
              type: 'svc:PresignedPostUpload',
              nextStep: {
                id: 'svc:S3FormPost',
                supportedOperation: [{ method: 'POST', expects: 'multipart/form-data' }],
              },
            },
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
