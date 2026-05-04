import type { JSONSchema7 } from 'json-schema'
import { describe, expect, it } from 'vitest'
import { HydraDoc } from '../HydraDoc.js'
import {
  makeClassDef,
  minimalOperationLink,
  minimalRepresentation,
  minimalView,
  PERMIT_RESPONSE_SCHEMA,
  PREFIXES,
  RENAME_SCHEMA,
} from './builder.fixtures.js'
import { buildHydraApiDocumentation } from './HydraBuilder.js'
import {
  buildOpenApiDocument,
  builtinPropertyDictionary,
  type HydraPropertyDocumentation,
  type OpenApiBuildResult,
} from './OpenApiBuilder.js'

const CREATE_SCHEMA: JSONSchema7 = {
  $id: 'urn:schema:test.CreateItem:1.0.0',
  type: 'object',
  properties: { name: { type: 'string' } },
  required: ['name'],
  additionalProperties: false,
}

function testCommandSurfaces() {
  return [
    HydraDoc.standardCreateCommandSurface({
      idStem: '#test',
      collectionHref: '/api/test/entities',
      operationId: 'createEntity',
    }),
    HydraDoc.standardCommandSurface({
      idStem: '#test',
      collectionHref: '/api/test/entities',
      idProperty: 'test:entityId',
      operationId: 'commandEntity',
    }),
  ]
}

const testPropertyDictionary: Record<string, HydraPropertyDocumentation> = {
  ...builtinPropertyDictionary,
  'test:entityId': { schema: { type: 'string' }, description: 'Entity identifier' },
  'svc:query': { schema: { type: 'string' }, description: 'Search query' },
}

/** Run Hydra build then OpenAPI build on the same classes. */
function build(
  classes: HydraDoc.ClassDef[],
  dictionary: Record<string, HydraPropertyDocumentation> = testPropertyDictionary,
): OpenApiBuildResult {
  const hydraBuild = buildHydraApiDocumentation({ classes, prefixes: PREFIXES })
  return buildOpenApiDocument({
    classes,
    hydraBuild,
    info: { title: 'Test API', version: '1.0.0' },
    hydraPropertyDictionary: dictionary,
  })
}

describe('buildOpenApiDocument', () => {
  describe('document structure', () => {
    it('produces a valid OpenAPI 3.1.0 document', () => {
      const result = buildMinimal()
      expect(result.document.openapi).toBe('3.1.0')
      expect(result.document.info.title).toBe('Test API')
      expect(result.document.info.version).toBe('1.0.0')
    })

    it('creates tags from class IRIs', () => {
      const result = buildMinimal()
      expect(result.document.tags).toEqual([{ name: 'Entity' }])
    })
  })

  describe('query surfaces (GET)', () => {
    it('generates GET operations for resource and collection surfaces', () => {
      const result = buildMinimal()
      const paths = result.document.paths

      expect(paths['/api/test/entities/{id}']?.get?.operationId).toBe('getEntity')
      expect(paths['/api/test/entities']?.get?.operationId).toBe('listEntities')
    })

    it('generates path parameters for resource surfaces', () => {
      const result = buildMinimal()
      const params = result.document.paths['/api/test/entities/{id}']?.get?.parameters
      expect(params).toEqual([
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Entity identifier',
        },
      ])
    })

    it('generates query parameters for collection surfaces', () => {
      const result = buildMinimal()
      const params = result.document.paths['/api/test/entities']?.get?.parameters
      expect(params).toEqual([
        { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search query' },
      ])
    })

    it('includes response schemas when provided', () => {
      const responseSchema: JSONSchema7 = {
        $id: 'urn:schema:test.EntityResponse:1.0.0',
        type: 'object',
        properties: { id: { type: 'string' } },
      }
      const result = build([
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
      ])

      const respContent =
        result.document.paths['/api/test/entities/{id}']?.get?.responses['200']?.content
      expect(respContent).toBeDefined()
      if (!respContent) return
      expect(respContent['application/json']?.schema.$ref).toBe(
        'urn:schema:test.EntityResponse:1.0.0',
      )
    })
  })

  describe('command surfaces (POST)', () => {
    it('generates POST for create surface with single command', () => {
      const result = buildWithCommands()
      const post = result.document.paths['/api/test/entities']?.post
      expect(post?.operationId).toBe('createEntity')
      expect(post?.tags).toEqual(['Entity'])
      expect(post?.requestBody?.content['application/json']?.schema.$ref).toBe(
        'urn:schema:test.CreateItem:1.0.0',
      )
    })

    it('uses direct $ref for single command on surface', () => {
      const result = buildWithCommands()
      const post = result.document.paths['/api/test/entities/{id}/command']?.post
      expect(post?.operationId).toBe('commandEntity')
      expect(post?.requestBody?.content['application/json']?.schema.$ref).toBe(
        'urn:schema:test.RenameItem:1.0.0',
      )
    })

    it('uses oneOf when multiple commands share a surface', () => {
      const result = buildWithMultipleEnvelopeCommands()
      const post = result.document.paths['/api/test/entities/{id}/command']?.post
      expect(post?.operationId).toBe('commandEntity')

      const bodySchema = post?.requestBody?.content['application/json']?.schema as unknown as {
        oneOf: Array<{ $ref: string }>
      }
      expect(bodySchema.oneOf).toHaveLength(2)
    })

    it('includes path parameters on command surface', () => {
      const result = buildWithCommands()
      const post = result.document.paths['/api/test/entities/{id}/command']?.post
      expect(post?.parameters).toEqual([
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Entity identifier',
        },
      ])
    })

    it('includes response schema on commands', () => {
      const result = buildWithResponseSchema()
      const respContent =
        result.document.paths['/api/test/entities']?.post?.responses['200']?.content
      expect(respContent).toBeDefined()
      if (!respContent) return
      expect(respContent['application/json']?.schema.$ref).toBe(
        'urn:schema:test.PermitResponse:1.0.0',
      )
    })

    it('marks operation deprecated when all commands on surface are deprecated', () => {
      const result = build([
        makeClassDef({
          surfaces: testCommandSurfaces(),
          commands: [
            {
              id: 'urn:command:test.CreateItem:1.0.0',
              stableId: 'test.CreateItem',
              version: '1.0.0',
              dispatch: 'create',
              schema: CREATE_SCHEMA,
              deprecated: true,
            },
          ],
        }),
      ])

      expect(result.document.paths['/api/test/entities']?.post?.deprecated).toBe(true)
    })
  })

  describe('events surfaces', () => {
    it('generates GET operations for item and aggregate event surfaces', () => {
      const result = buildWithEvents()
      const paths = result.document.paths

      expect(paths['/api/test/entities/{id}/events']?.get).toBeDefined()
      expect(paths['/api/events/entities']?.get).toBeDefined()
      // Events surfaces are auto-generated without operationId — warnings expected
      expect(paths['/api/test/entities/{id}/events']?.get?.operationId).toBeUndefined()
      expect(paths['/api/events/entities']?.get?.operationId).toBeUndefined()
    })

    it('includes limit and afterPosition as query parameters on event surfaces', () => {
      const result = buildWithEvents()
      const params = result.document.paths['/api/test/entities/{id}/events']?.get?.parameters
      expect(params).toBeDefined()
      if (!params) return

      const limitParam = params.find((p) => p.name === 'limit')
      expect(limitParam?.in).toBe('query')
      expect(limitParam?.schema).toEqual({ type: 'integer', minimum: 1 })

      const afterParam = params.find((p) => p.name === 'afterPosition')
      expect(afterParam?.in).toBe('query')
    })
  })

  describe('property dictionary', () => {
    it('warns about missing dictionary entries with copy-pasteable output', () => {
      const result = build(
        [{ class: 'test:Entity', representations: [minimalRepresentation()] }],
        {},
      )
      const dictWarning = result.warnings.find((w) => w.includes('Missing hydraPropertyDictionary'))
      expect(dictWarning).toBeDefined()
      expect(dictWarning).toContain("'test:entityId'")
      expect(dictWarning).toContain("'svc:query'")
    })

    it('uses per-mapping schema override over registry', () => {
      const override: JSONSchema7 = { type: 'string', enum: ['a', 'b'] }
      const result = build([
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
                  mappings: [
                    { variable: 'id', property: 'test:entityId', required: true, schema: override },
                  ],
                },
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
      ])

      const params = result.document.paths['/api/test/entities/{id}']?.get?.parameters
      expect(params?.[0]?.schema).toEqual(override)
    })

    it('omits schema when property is missing from registry and has no override', () => {
      const result = build(
        [{ class: 'test:Entity', representations: [minimalRepresentation()] }],
        {},
      )
      const params = result.document.paths['/api/test/entities/{id}']?.get?.parameters
      expect(params?.[0]?.schema).toBeUndefined()
    })
  })

  describe('response resolution', () => {
    const ERROR_400_SCHEMA: JSONSchema7 = {
      $id: 'urn:schema:test.BadRequest:1.0.0',
      type: 'object',
      properties: { message: { type: 'string' } },
    }
    const ERROR_500_SCHEMA: JSONSchema7 = {
      $id: 'urn:schema:test.InternalError:1.0.0',
      type: 'object',
      properties: { message: { type: 'string' } },
    }
    const ERROR_404_SCHEMA: JSONSchema7 = {
      $id: 'urn:schema:test.NotFound:1.0.0',
      type: 'object',
      properties: { message: { type: 'string' } },
    }
    const CUSTOM_400_SCHEMA: JSONSchema7 = {
      $id: 'urn:schema:test.CustomBadRequest:1.0.0',
      type: 'object',
      properties: { errors: { type: 'array' } },
    }

    function buildWithResponses(opts: {
      globalResponses?: HydraDoc.ResolvedResponseDef[]
      responses?: HydraDoc.ResolvedResponseDef[]
      surfaceResponses?: readonly HydraDoc.ResponseEntry[]
      commandResponses?: readonly HydraDoc.ResponseEntry[]
      querySurfaceResponses?: readonly HydraDoc.ResponseEntry[]
    }): OpenApiBuildResult {
      const classes: HydraDoc.ClassDef[] = [
        {
          class: 'test:Entity',
          commands: new HydraDoc.CommandsDef<never>({
            surfaces: [
              {
                dispatch: 'create',
                method: 'POST',
                operationId: 'createEntity',
                template: {
                  id: '#test-mut-create',
                  template: '/api/test/entities',
                  mappings: [],
                },
                responses: opts.surfaceResponses,
              },
            ],
            commands: [
              {
                id: 'urn:command:test.CreateItem:1.0.0',
                stableId: 'test.CreateItem',
                version: '1.0.0',
                dispatch: 'create',
                schema: CREATE_SCHEMA,
                responses: opts.commandResponses,
              },
            ],
          }),
          representations: [
            new HydraDoc.Representation({
              id: '#test-entity-v1_0_0',
              version: '1.0.0',
              resource: {
                profile: 'urn:profile:test.Entity:1.0.0',
                formats: ['application/json'],
                operationId: 'getEntity',
                template: {
                  id: '#test-entity-resource-v1_0_0',
                  template: '/api/test/entities/{id}',
                  mappings: [{ variable: 'id', property: 'test:entityId', required: true }],
                },
                responses: opts.querySurfaceResponses,
              },
              collection: {
                profile: 'urn:profile:test.EntityCollection:1.0.0',
                formats: ['application/json'],
                operationId: 'listEntities',
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
      ]
      const hydraBuild = buildHydraApiDocumentation({ classes, prefixes: PREFIXES })
      return buildOpenApiDocument({
        classes,
        hydraBuild,
        info: { title: 'Test API', version: '1.0.0' },
        hydraPropertyDictionary: testPropertyDictionary,
        globalResponses: opts.globalResponses,
        responses: opts.responses,
      })
    }

    it('globalResponses appear on every operation', () => {
      const result = buildWithResponses({
        globalResponses: [
          {
            code: 500,
            contentType: 'application/json',
            schema: ERROR_500_SCHEMA,
          },
        ],
      })

      // GET operation has 500
      const getResp = result.document.paths['/api/test/entities/{id}']?.get?.responses
      expect(getResp?.['500']).toBeDefined()
      expect(getResp?.['500']?.content?.['application/json']?.schema.$ref).toBe(
        'urn:schema:test.InternalError:1.0.0',
      )

      // POST operation has 500
      const postResp = result.document.paths['/api/test/entities']?.post?.responses
      expect(postResp?.['500']).toBeDefined()
      expect(postResp?.['500']?.content?.['application/json']?.schema.$ref).toBe(
        'urn:schema:test.InternalError:1.0.0',
      )
    })

    it('globalResponses cannot be opted out by omitting the code', () => {
      const result = buildWithResponses({
        globalResponses: [{ code: 500, contentType: 'application/json', schema: ERROR_500_SCHEMA }],
        commandResponses: [{ code: 200, schema: PERMIT_RESPONSE_SCHEMA }],
      })

      const postResp = result.document.paths['/api/test/entities']?.post?.responses
      expect(postResp?.['200']).toBeDefined()
      expect(postResp?.['500']).toBeDefined()
    })

    it('command responses override surface responses', () => {
      const result = buildWithResponses({
        responses: [{ code: 400, contentType: 'application/json', schema: ERROR_400_SCHEMA }],
        surfaceResponses: [400],
        commandResponses: [
          { code: 200, schema: PERMIT_RESPONSE_SCHEMA },
          { code: 400, schema: CUSTOM_400_SCHEMA },
        ],
      })

      const postResp = result.document.paths['/api/test/entities']?.post?.responses
      expect(postResp?.['400']?.content?.['application/json']?.schema.$ref).toBe(
        'urn:schema:test.CustomBadRequest:1.0.0',
      )
    })

    it('command inherits schema from surface when not specified', () => {
      const result = buildWithResponses({
        responses: [{ code: 400, contentType: 'application/json', schema: ERROR_400_SCHEMA }],
        surfaceResponses: [{ code: 400, schema: CUSTOM_400_SCHEMA }],
        commandResponses: [{ code: 200, schema: PERMIT_RESPONSE_SCHEMA }, 400],
      })

      const postResp = result.document.paths['/api/test/entities']?.post?.responses
      expect(postResp?.['400']?.content?.['application/json']?.schema.$ref).toBe(
        'urn:schema:test.CustomBadRequest:1.0.0',
      )
    })

    it('falls back to registry when surface has no schema', () => {
      const result = buildWithResponses({
        responses: [{ code: 400, contentType: 'application/json', schema: ERROR_400_SCHEMA }],
        surfaceResponses: [400],
        commandResponses: [{ code: 200, schema: PERMIT_RESPONSE_SCHEMA }, 400],
      })

      const postResp = result.document.paths['/api/test/entities']?.post?.responses
      expect(postResp?.['400']?.content?.['application/json']?.schema.$ref).toBe(
        'urn:schema:test.BadRequest:1.0.0',
      )
    })

    it('warns when no schema found at any level', () => {
      const result = buildWithResponses({
        commandResponses: [{ code: 200, schema: PERMIT_RESPONSE_SCHEMA }, 400],
      })

      expect(result.warnings.some((w) => w.includes('No schema found for response (400'))).toBe(
        true,
      )
    })

    it('empty responses array opts out of all inherited pairs', () => {
      const result = buildWithResponses({
        globalResponses: [{ code: 500, contentType: 'application/json', schema: ERROR_500_SCHEMA }],
        surfaceResponses: [400, 404],
        commandResponses: [],
      })

      const postResp = result.document.paths['/api/test/entities']?.post?.responses
      // Global 500 still present
      expect(postResp?.['500']).toBeDefined()
      // Surface 400 and 404 opted out
      expect(postResp?.['400']).toBeUndefined()
      expect(postResp?.['404']).toBeUndefined()
    })

    it('NO_BODY produces response without content', () => {
      const result = buildWithResponses({
        commandResponses: [{ code: 204, schema: HydraDoc.NO_BODY }],
      })

      const postResp = result.document.paths['/api/test/entities']?.post?.responses
      expect(postResp?.['204']).toBeDefined()
      expect(postResp?.['204']?.content).toBeUndefined()
    })

    it('query surface responses appear on GET operations', () => {
      const result = buildWithResponses({
        responses: [{ code: 404, contentType: 'application/json', schema: ERROR_404_SCHEMA }],
        querySurfaceResponses: [{ code: 200, schema: PERMIT_RESPONSE_SCHEMA }, 404],
      })

      const getResp = result.document.paths['/api/test/entities/{id}']?.get?.responses
      expect(getResp?.['200']?.content?.['application/json']?.schema.$ref).toBe(
        'urn:schema:test.PermitResponse:1.0.0',
      )
      expect(getResp?.['404']?.content?.['application/json']?.schema.$ref).toBe(
        'urn:schema:test.NotFound:1.0.0',
      )
    })

    it('multi-contentType entries for same code merge into content map', () => {
      const halSchema: JSONSchema7 = {
        $id: 'urn:schema:test.EntityHal:1.0.0',
        type: 'object',
        properties: { _links: { type: 'object' } },
      }
      const result = buildWithResponses({
        querySurfaceResponses: [
          { code: 200, schema: PERMIT_RESPONSE_SCHEMA },
          { code: 200, contentType: 'application/hal+json', schema: halSchema },
        ],
      })

      const getResp = result.document.paths['/api/test/entities/{id}']?.get?.responses
      const content = getResp?.['200']?.content
      expect(content?.['application/json']?.schema.$ref).toBe(
        'urn:schema:test.PermitResponse:1.0.0',
      )
      expect(content?.['application/hal+json']?.schema.$ref).toBe('urn:schema:test.EntityHal:1.0.0')
    })
  })

  describe('shared command surface response merge', () => {
    const SUCCESS_SCHEMA_A: JSONSchema7 = {
      $id: 'urn:schema:test.SuccessA:1.0.0',
      type: 'object',
      properties: { id: { type: 'string' } },
    }
    const SUCCESS_SCHEMA_B: JSONSchema7 = {
      $id: 'urn:schema:test.SuccessB:1.0.0',
      type: 'object',
      properties: { ids: { type: 'array' } },
    }

    it('deduplicates same $id across commands for same code', () => {
      const result = build([
        {
          class: 'test:Entity',
          commands: new HydraDoc.CommandsDef({
            surfaces: testCommandSurfaces(),
            commands: [
              {
                id: 'urn:command:test.RenameItem:1.0.0',
                stableId: 'test.RenameItem',
                version: '1.0.0',
                dispatch: 'command',
                commandType: 'rename',
                schema: RENAME_SCHEMA,
                responses: [{ code: 200, schema: SUCCESS_SCHEMA_A }],
              },
              {
                id: 'urn:command:test.DeleteItem:1.0.0',
                stableId: 'test.DeleteItem',
                version: '1.0.0',
                dispatch: 'command',
                commandType: 'delete',
                schema: DELETE_SCHEMA,
                responses: [{ code: 200, schema: SUCCESS_SCHEMA_A }],
              },
            ],
          }),
          representations: [minimalRepresentation()],
        },
      ])

      const postResp = result.document.paths['/api/test/entities/{id}/command']?.post?.responses
      const content = postResp?.['200']?.content
      expect(content?.['application/json']?.schema.$ref).toBe('urn:schema:test.SuccessA:1.0.0')
    })

    it('uses oneOf when commands have different schemas for same code', () => {
      const result = build([
        {
          class: 'test:Entity',
          commands: new HydraDoc.CommandsDef({
            surfaces: testCommandSurfaces(),
            commands: [
              {
                id: 'urn:command:test.RenameItem:1.0.0',
                stableId: 'test.RenameItem',
                version: '1.0.0',
                dispatch: 'command',
                commandType: 'rename',
                schema: RENAME_SCHEMA,
                responses: [{ code: 200, schema: SUCCESS_SCHEMA_A }],
              },
              {
                id: 'urn:command:test.DeleteItem:1.0.0',
                stableId: 'test.DeleteItem',
                version: '1.0.0',
                dispatch: 'command',
                commandType: 'delete',
                schema: DELETE_SCHEMA,
                responses: [{ code: 200, schema: SUCCESS_SCHEMA_B }],
              },
            ],
          }),
          representations: [minimalRepresentation()],
        },
      ])

      const postResp = result.document.paths['/api/test/entities/{id}/command']?.post?.responses
      const schema = postResp?.['200']?.content?.['application/json']?.schema as unknown as {
        oneOf: Array<{ $ref: string }>
      }
      expect(schema.oneOf).toHaveLength(2)
      const refs = schema.oneOf.map((s) => s.$ref).sort()
      expect(refs).toEqual(['urn:schema:test.SuccessA:1.0.0', 'urn:schema:test.SuccessB:1.0.0'])
    })

    it('command omitting a code does not suppress it from other commands', () => {
      const ERROR_SCHEMA: JSONSchema7 = {
        $id: 'urn:schema:test.Error:1.0.0',
        type: 'object',
        properties: { message: { type: 'string' } },
      }
      const result = build([
        {
          class: 'test:Entity',
          commands: new HydraDoc.CommandsDef({
            surfaces: testCommandSurfaces(),
            commands: [
              {
                id: 'urn:command:test.RenameItem:1.0.0',
                stableId: 'test.RenameItem',
                version: '1.0.0',
                dispatch: 'command',
                commandType: 'rename',
                schema: RENAME_SCHEMA,
                responses: [
                  { code: 200, schema: SUCCESS_SCHEMA_A },
                  { code: 400, schema: ERROR_SCHEMA },
                ],
              },
              {
                id: 'urn:command:test.DeleteItem:1.0.0',
                stableId: 'test.DeleteItem',
                version: '1.0.0',
                dispatch: 'command',
                commandType: 'delete',
                schema: DELETE_SCHEMA,
                responses: [{ code: 200, schema: SUCCESS_SCHEMA_A }],
              },
            ],
          }),
          representations: [minimalRepresentation()],
        },
      ])

      const postResp = result.document.paths['/api/test/entities/{id}/command']?.post?.responses
      // 400 from RenameItem still present even though DeleteItem omits it
      expect(postResp?.['400']).toBeDefined()
      expect(postResp?.['400']?.content?.['application/json']?.schema.$ref).toBe(
        'urn:schema:test.Error:1.0.0',
      )
    })
  })

  describe('output stability', () => {
    it('produces stable JSON output (sorted keys)', () => {
      const result = buildMinimal()
      const parsed = JSON.parse(result.content)
      const keys = Object.keys(parsed)
      expect(keys).toEqual([...keys].sort())
    })
  })

  describe('view via supportedProperty', () => {
    it('emits a GET operation at the view collection path', () => {
      const result = buildWithSupportedProperty()
      const op = result.document.paths['/api/test/parents/{id}/children']?.get
      expect(op).toBeDefined()
      expect(op?.operationId).toBe('getParentChildren')
    })

    it('tags the operation under the parent class', () => {
      const result = buildWithSupportedProperty()
      const op = result.document.paths['/api/test/parents/{id}/children']?.get
      expect(op?.tags).toEqual(['Entity'])
    })

    it('preserves path and query parameters from the view collection template', () => {
      const result = buildWithSupportedProperty()
      const params = result.document.paths['/api/test/parents/{id}/children']?.get?.parameters
      expect(params).toEqual([
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Parent identifier',
        },
        { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search query' },
      ])
    })

    it('emits view collection responses', () => {
      const responseSchema: JSONSchema7 = {
        $id: 'urn:schema:test.ChildrenResponse:1.0.0',
        type: 'object',
        properties: { items: { type: 'array' } },
      }
      const result = build(
        [
          {
            class: 'test:Entity',
            representations: [minimalRepresentation()],
            supportedProperties: [
              {
                property: 'test:children',
                links: [
                  new HydraDoc.ViewRepresentation({
                    id: '#test-children-view-v1_0_0',
                    version: '1.0.0',
                    base: minimalRepresentation(),
                    collection: {
                      profile: 'urn:profile:test.ParentChildren:1.0.0',
                      formats: ['application/json'],
                      operationId: 'getParentChildren',
                      href: '/api/test/parents/{id}/children',
                      template: {
                        id: '#test-children-view-collection-v1_0_0',
                        template: '/api/test/parents/{id}/children',
                        mappings: [
                          { variable: 'id', property: 'test:parentId', required: true },
                          { variable: 'q', property: 'svc:query' },
                        ],
                      },
                      responses: [{ code: 200, schema: responseSchema }],
                    },
                  }),
                ],
              },
            ],
          },
        ],
        {
          ...testPropertyDictionary,
          'test:parentId': { schema: { type: 'string' }, description: 'Parent identifier' },
        },
      )
      const op = result.document.paths['/api/test/parents/{id}/children']?.get
      expect(op?.responses?.['200']?.content?.['application/json']?.schema.$ref).toBe(
        'urn:schema:test.ChildrenResponse:1.0.0',
      )
    })

    it('first registered view wins for the same path (multi-version dedup)', () => {
      const result = build(
        [
          {
            class: 'test:Entity',
            representations: [minimalRepresentation()],
            supportedProperties: [
              {
                property: 'test:children',
                links: [
                  minimalView({
                    id: '#test-children-view-v1_0_0',
                    version: '1.0.0',
                    operationId: 'getChildrenV1',
                  }),
                  minimalView({
                    id: '#test-children-view-v1_1_0',
                    version: '1.1.0',
                    operationId: 'getChildrenV1_1',
                  }),
                ],
              },
            ],
          },
        ],
        {
          ...testPropertyDictionary,
          'test:parentId': { schema: { type: 'string' }, description: 'Parent identifier' },
        },
      )
      const op = result.document.paths['/api/test/parents/{id}/children']?.get
      expect(op?.operationId).toBe('getChildrenV1')
    })
  })

  describe('operation link via supportedProperty', () => {
    it('emits a GET at the operation surface path', () => {
      const result = buildWithOperationLink()
      const op = result.document.paths['/api/test/entities/{id}/action']?.get
      expect(op).toBeDefined()
      expect(op?.operationId).toBe('entityAction')
    })

    it('tags the operation under the parent class', () => {
      const result = buildWithOperationLink()
      const op = result.document.paths['/api/test/entities/{id}/action']?.get
      expect(op?.tags).toEqual(['Entity'])
    })

    it('does not require query parameters', () => {
      const result = buildWithOperationLink()
      const op = result.document.paths['/api/test/entities/{id}/action']?.get
      const queryParams = op?.parameters?.filter((p) => 'in' in p && p.in === 'query') ?? []
      expect(queryParams).toEqual([])
    })

    it('preserves required path parameters', () => {
      const result = buildWithOperationLink()
      const op = result.document.paths['/api/test/entities/{id}/action']?.get
      expect(op?.parameters).toEqual([
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Entity identifier',
        },
      ])
    })
  })

  describe('headers', () => {
    const SCHEMA_200: JSONSchema7 = {
      $id: 'urn:schema:test.Result:1.0.0',
      type: 'object',
      properties: {},
      additionalProperties: false,
    }

    function buildWithHeaders(opts: {
      classes: HydraDoc.ClassDef[]
      requestHeaders?: Record<string, HydraDoc.HeaderDef>
      globalRequestHeaders?: readonly HydraDoc.HeaderEntry[]
      responseHeaders?: Record<string, HydraDoc.HeaderDef>
      globalResponseHeaders?: readonly HydraDoc.HeaderEntry[]
    }): OpenApiBuildResult {
      const hydraBuild = buildHydraApiDocumentation({ classes: opts.classes, prefixes: PREFIXES })
      return buildOpenApiDocument({
        classes: opts.classes,
        hydraBuild,
        info: { title: 'Test API', version: '1.0.0' },
        hydraPropertyDictionary: testPropertyDictionary,
        requestHeaders: opts.requestHeaders,
        globalRequestHeaders: opts.globalRequestHeaders,
        responseHeaders: opts.responseHeaders,
        globalResponseHeaders: opts.globalResponseHeaders,
      })
    }

    function makeQueryClass(
      overrides: {
        resourceRequestHeaders?: readonly HydraDoc.HeaderEntry[]
        resourceResponses?: readonly HydraDoc.ResponseEntry[]
      } = {},
    ): HydraDoc.ClassDef {
      return {
        class: 'test:Entity',
        representations: [
          new HydraDoc.Representation({
            id: '#test-entity-v1_0_0',
            version: '1.0.0',
            resource: {
              profile: 'urn:profile:test.Entity:1.0.0',
              formats: ['application/json'],
              operationId: 'getEntity',
              template: {
                id: '#test-entity-resource-v1_0_0',
                template: '/api/test/entities/{id}',
                mappings: [{ variable: 'id', property: 'test:entityId', required: true }],
              },
              requestHeaders: overrides.resourceRequestHeaders,
              responses: overrides.resourceResponses,
            },
            collection: {
              profile: 'urn:profile:test.EntityCollection:1.0.0',
              formats: ['application/json'],
              operationId: 'listEntities',
              href: '/api/test/entities',
              template: {
                id: '#test-entity-collection-v1_0_0',
                template: '/api/test/entities',
                mappings: [{ variable: 'q', property: 'svc:query' }],
              },
            },
          }),
        ],
      }
    }

    it('inline request header lands as parameters[in:header] and never emits required:false', () => {
      const result = buildWithHeaders({
        classes: [
          makeQueryClass({
            resourceRequestHeaders: [
              { name: 'X-Foo', schema: { type: 'string' }, description: 'foo' },
            ],
          }),
        ],
      })
      const params = result.document.paths['/api/test/entities/{id}']?.get?.parameters ?? []
      const header = params.find((p) => p.in === 'header')
      expect(header).toEqual({
        name: 'X-Foo',
        in: 'header',
        description: 'foo',
        schema: { type: 'string' },
      })
      expect(JSON.stringify(header)).not.toContain('"required":false')
      expect(result.warnings).toEqual([])
    })

    it('registry-referenced request header resolves; unknown reference produces a warning', () => {
      const result = buildWithHeaders({
        classes: [
          makeQueryClass({
            resourceRequestHeaders: ['X-Tenant-Id', 'X-Missing'],
          }),
        ],
        requestHeaders: {
          'X-Tenant-Id': { schema: { type: 'string' }, description: 'tenant' },
        },
      })
      const params = result.document.paths['/api/test/entities/{id}']?.get?.parameters ?? []
      const headers = params.filter((p) => p.in === 'header')
      expect(headers).toEqual([
        {
          name: 'X-Tenant-Id',
          in: 'header',
          description: 'tenant',
          schema: { type: 'string' },
        },
      ])
      expect(result.warnings.some((w) => w.includes("Unknown header reference 'X-Missing'"))).toBe(
        true,
      )
    })

    it('globalRequestHeaders appear on every operation; per-op same-name override replaces value at first-seen position', () => {
      const result = buildWithHeaders({
        classes: [
          makeQueryClass({
            resourceRequestHeaders: [
              { name: 'X-Trace', schema: { type: 'string' }, description: 'overridden trace' },
            ],
          }),
        ],
        requestHeaders: {
          'X-Trace': { schema: { type: 'string' }, description: 'global trace' },
          'X-Region': { schema: { type: 'string' }, description: 'global region' },
        },
        globalRequestHeaders: ['X-Trace', 'X-Region'],
      })
      const getHeaders =
        result.document.paths['/api/test/entities/{id}']?.get?.parameters?.filter(
          (p) => p.in === 'header',
        ) ?? []
      const listHeaders =
        result.document.paths['/api/test/entities']?.get?.parameters?.filter(
          (p) => p.in === 'header',
        ) ?? []

      // Resource: override at position 0 (where X-Trace global was), region at position 1
      expect(getHeaders.map((h) => h.name)).toEqual(['X-Trace', 'X-Region'])
      expect(getHeaders[0]?.description).toBe('overridden trace')
      expect(getHeaders[1]?.description).toBe('global region')

      // Collection: globals only
      expect(listHeaders.map((h) => h.name)).toEqual(['X-Trace', 'X-Region'])
      expect(listHeaders[0]?.description).toBe('global trace')
    })

    it('empty resourceRequestHeaders does not drop globals (globals are non-opt-outable)', () => {
      const result = buildWithHeaders({
        classes: [makeQueryClass({ resourceRequestHeaders: [] })],
        requestHeaders: { 'X-Trace': { schema: { type: 'string' } } },
        globalRequestHeaders: ['X-Trace'],
      })
      const headers =
        result.document.paths['/api/test/entities/{id}']?.get?.parameters?.filter(
          (p) => p.in === 'header',
        ) ?? []
      expect(headers.map((h) => h.name)).toEqual(['X-Trace'])
    })

    it('inline response header on 200 lands as responses.200.headers[name]', () => {
      const result = buildWithHeaders({
        classes: [
          makeQueryClass({
            resourceResponses: [
              {
                code: 200,
                schema: SCHEMA_200,
                responseHeaders: [
                  { name: 'X-Foo', schema: { type: 'string' }, description: 'foo' },
                ],
              },
            ],
          }),
        ],
      })
      const resp200 = result.document.paths['/api/test/entities/{id}']?.get?.responses?.['200']
      expect(resp200?.headers?.['X-Foo']).toEqual({
        description: 'foo',
        schema: { type: 'string' },
      })
      // No required:false since the inline header didn't set required
      expect(JSON.stringify(resp200?.headers?.['X-Foo'])).not.toContain('"required":false')
    })

    it('307 with NO_BODY + Location header emits {description, headers.Location} with no content', () => {
      const result = buildWithHeaders({
        classes: [
          {
            class: 'test:Entity',
            representations: [minimalRepresentation()],
            supportedProperties: [
              {
                property: 'test:download',
                links: [
                  new HydraDoc.OperationLink({
                    id: '#test-entity-download-v1_0_0',
                    version: '1.0.0',
                    operation: {
                      profile: 'urn:profile:test.EntityDownload:1.0.0',
                      formats: ['application/json'],
                      operationId: 'downloadEntity',
                      template: {
                        id: '#test-entity-download-surface-v1_0_0',
                        template: '/api/test/entities/{id}/download',
                        mappings: [{ variable: 'id', property: 'test:entityId', required: true }],
                      },
                      responses: [
                        {
                          code: 307,
                          schema: HydraDoc.NO_BODY,
                          description: 'Redirect to presigned URL.',
                          responseHeaders: ['Location'],
                        },
                      ],
                    },
                  }),
                ],
              },
            ],
          },
        ],
        responseHeaders: {
          Location: {
            schema: { type: 'string', format: 'uri' },
            required: true,
            description: 'Redirect target.',
          },
        },
      })
      const resp307 =
        result.document.paths['/api/test/entities/{id}/download']?.get?.responses?.['307']
      expect(resp307?.description).toBe('Redirect to presigned URL.')
      expect(resp307?.content).toBeUndefined()
      expect(resp307?.headers?.['Location']).toEqual({
        description: 'Redirect target.',
        required: true,
        schema: { type: 'string', format: 'uri' },
      })
    })

    it('response headers across content-type variants merge per status; first-seen wins on conflict and warning emitted', () => {
      const halSchema: JSONSchema7 = {
        $id: 'urn:schema:test.HalResult:1.0.0',
        type: 'object',
        properties: {},
        additionalProperties: false,
      }
      const result = buildWithHeaders({
        classes: [
          makeQueryClass({
            resourceResponses: [
              {
                code: 200,
                contentType: 'application/json',
                schema: SCHEMA_200,
                responseHeaders: [
                  { name: 'ETag', schema: { type: 'string' }, description: 'json etag' },
                  { name: 'X-Variant', schema: { type: 'string' }, description: 'json variant' },
                ],
              },
              {
                code: 200,
                contentType: 'application/hal+json',
                schema: halSchema,
                responseHeaders: [
                  { name: 'ETag', schema: { type: 'string' }, description: 'hal etag (loses)' },
                  { name: 'X-Hal', schema: { type: 'string' }, description: 'hal-only' },
                ],
              },
            ],
          }),
        ],
      })
      const resp200 = result.document.paths['/api/test/entities/{id}']?.get?.responses?.['200']
      expect(resp200?.headers?.['ETag']?.description).toBe('json etag')
      expect(resp200?.headers?.['X-Variant']?.description).toBe('json variant')
      expect(resp200?.headers?.['X-Hal']?.description).toBe('hal-only')
      // Both content types remain on the same response object
      expect(Object.keys(resp200?.content ?? {}).sort()).toEqual([
        'application/hal+json',
        'application/json',
      ])
      expect(result.warnings.some((w) => w.includes("Conflicting per-op header 'ETag'"))).toBe(true)
    })

    it('multi-command POST: response headers union across commands (first-seen wins); differing schemas still produce oneOf', () => {
      const otherSchema: JSONSchema7 = {
        $id: 'urn:schema:test.OtherCmd:1.0.0',
        type: 'object',
        properties: {},
        additionalProperties: false,
      }
      const successA: JSONSchema7 = {
        $id: 'urn:schema:test.SuccessA:1.0.0',
        type: 'object',
        properties: {},
      }
      const successB: JSONSchema7 = {
        $id: 'urn:schema:test.SuccessB:1.0.0',
        type: 'object',
        properties: {},
      }
      const result = buildWithHeaders({
        classes: [
          {
            class: 'test:Entity',
            representations: [minimalRepresentation()],
            commands: new HydraDoc.CommandsDef<never>({
              surfaces: testCommandSurfaces(),
              commands: [
                {
                  id: 'urn:command:test.A:1.0.0',
                  stableId: 'test.A',
                  version: '1.0.0',
                  dispatch: 'command',
                  commandType: 'a',
                  schema: RENAME_SCHEMA,
                  responses: [
                    {
                      code: 200,
                      schema: successA,
                      responseHeaders: [
                        {
                          name: 'X-Trace',
                          schema: { type: 'string' },
                          description: 'trace from A',
                        },
                      ],
                    },
                  ],
                },
                {
                  id: 'urn:command:test.B:1.0.0',
                  stableId: 'test.B',
                  version: '1.0.0',
                  dispatch: 'command',
                  commandType: 'b',
                  schema: otherSchema,
                  responses: [
                    {
                      code: 200,
                      schema: successB,
                      responseHeaders: [
                        {
                          name: 'X-Trace',
                          schema: { type: 'string' },
                          description: 'trace from B (loses)',
                        },
                        { name: 'X-B-Only', schema: { type: 'string' }, description: 'B unique' },
                      ],
                    },
                  ],
                },
              ],
            }),
          },
        ],
      })
      const resp200 =
        result.document.paths['/api/test/entities/{id}/command']?.post?.responses?.['200']
      expect(resp200?.headers?.['X-Trace']?.description).toBe('trace from A')
      expect(resp200?.headers?.['X-B-Only']?.description).toBe('B unique')
      const schema = resp200?.content?.['application/json']?.schema as unknown as {
        oneOf: { $ref: string }[]
      }
      expect(schema.oneOf).toEqual([
        { $ref: 'urn:schema:test.SuccessA:1.0.0' },
        { $ref: 'urn:schema:test.SuccessB:1.0.0' },
      ])
    })

    it('reserved header names (Content-Type, Accept, Authorization) are skipped with warnings, regardless of casing', () => {
      const result = buildWithHeaders({
        classes: [
          makeQueryClass({
            resourceRequestHeaders: [
              { name: 'Content-Type', schema: { type: 'string' } },
              { name: 'accept', schema: { type: 'string' } },
              { name: 'AUTHORIZATION', schema: { type: 'string' } },
              { name: 'X-Allowed', schema: { type: 'string' } },
            ],
          }),
        ],
      })
      const headers =
        result.document.paths['/api/test/entities/{id}']?.get?.parameters?.filter(
          (p) => p.in === 'header',
        ) ?? []
      expect(headers.map((h) => h.name)).toEqual(['X-Allowed'])

      const reservedWarnings = result.warnings.filter((w) => w.includes('reserved by OpenAPI 3.1'))
      expect(reservedWarnings).toHaveLength(3)
      expect(reservedWarnings.some((w) => w.includes("'Content-Type'"))).toBe(true)
      expect(reservedWarnings.some((w) => w.includes("'accept'"))).toBe(true)
      expect(reservedWarnings.some((w) => w.includes("'AUTHORIZATION'"))).toBe(true)
    })

    it('case-insensitive conflict: per-op (x-foo) overrides global (X-Foo) value but first-seen casing wins', () => {
      const result = buildWithHeaders({
        classes: [
          makeQueryClass({
            resourceRequestHeaders: [
              { name: 'x-foo', schema: { type: 'string' }, description: 'per-op' },
            ],
          }),
        ],
        requestHeaders: { 'X-Foo': { schema: { type: 'string' }, description: 'global' } },
        globalRequestHeaders: ['X-Foo'],
      })
      const headers =
        result.document.paths['/api/test/entities/{id}']?.get?.parameters?.filter(
          (p) => p.in === 'header',
        ) ?? []
      expect(headers).toHaveLength(1)
      expect(headers[0]?.name).toBe('X-Foo')
      expect(headers[0]?.description).toBe('per-op')
    })

    it('HydraBuilder JSON-LD output contains no header-related structural keys', () => {
      const classes: HydraDoc.ClassDef[] = [
        makeQueryClass({
          resourceRequestHeaders: [
            { name: 'X-Foo', schema: { type: 'string' }, description: 'inline req' },
          ],
          resourceResponses: [
            {
              code: 200,
              schema: SCHEMA_200,
              responseHeaders: [
                { name: 'X-Bar', schema: { type: 'string' }, description: 'inline resp' },
              ],
            },
          ],
        }),
      ]
      const hydraBuild = buildHydraApiDocumentation({ classes, prefixes: PREFIXES })
      const jsonStr = hydraBuild.content
      expect(jsonStr).not.toMatch(/"requestHeaders"/)
      expect(jsonStr).not.toMatch(/"responseHeaders"/)
      expect(jsonStr).not.toMatch(/"globalRequestHeaders"/)
      expect(jsonStr).not.toMatch(/"globalResponseHeaders"/)
      expect(jsonStr).not.toMatch(/"headers"/)
    })
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMinimal(): OpenApiBuildResult {
  return build([{ class: 'test:Entity', representations: [minimalRepresentation()] }])
}

function buildWithCommands(): OpenApiBuildResult {
  return build([
    makeClassDef({
      surfaces: testCommandSurfaces(),
      commands: [
        {
          id: 'urn:command:test.CreateItem:1.0.0',
          stableId: 'test.CreateItem',
          version: '1.0.0',
          dispatch: 'create',
          schema: CREATE_SCHEMA,
        },
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
  ])
}

function buildWithResponseSchema(): OpenApiBuildResult {
  return build([
    makeClassDef({
      surfaces: testCommandSurfaces(),
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
  ])
}

const DELETE_SCHEMA: JSONSchema7 = {
  $id: 'urn:schema:test.DeleteItem:1.0.0',
  type: 'object',
  properties: {},
  additionalProperties: false,
}

function buildWithMultipleEnvelopeCommands(): OpenApiBuildResult {
  return build([
    makeClassDef({
      surfaces: testCommandSurfaces(),
      commands: [
        {
          id: 'urn:command:test.CreateItem:1.0.0',
          stableId: 'test.CreateItem',
          version: '1.0.0',
          dispatch: 'create',
          schema: CREATE_SCHEMA,
        },
        {
          id: 'urn:command:test.RenameItem:1.0.0',
          stableId: 'test.RenameItem',
          version: '1.0.0',
          dispatch: 'command',
          commandType: 'rename',
          schema: RENAME_SCHEMA,
        },
        {
          id: 'urn:command:test.DeleteItem:1.0.0',
          stableId: 'test.DeleteItem',
          version: '1.0.0',
          dispatch: 'command',
          commandType: 'delete',
          schema: DELETE_SCHEMA,
        },
      ],
    }),
  ])
}

function buildWithSupportedProperty(): OpenApiBuildResult {
  return build(
    [
      {
        class: 'test:Entity',
        representations: [minimalRepresentation()],
        supportedProperties: [{ property: 'test:children', links: [minimalView()] }],
      },
    ],
    {
      ...testPropertyDictionary,
      'test:parentId': { schema: { type: 'string' }, description: 'Parent identifier' },
    },
  )
}

function buildWithOperationLink(): OpenApiBuildResult {
  return build([
    {
      class: 'test:Entity',
      representations: [minimalRepresentation()],
      supportedProperties: [{ property: 'test:action', links: [minimalOperationLink()] }],
    },
  ])
}

function buildWithEvents(): OpenApiBuildResult {
  return build([
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
          events: {
            resourceSegment: 'entities',
            baseHref: '/api',
            item: {
              id: 'urn:representation:test.EntityItemEvent:1.0.0',
              profile: 'urn:profile:test.EntityItemEvent:1.0.0',
            },
            aggregate: {
              id: 'urn:representation:test.EntityEvent:1.0.0',
              profile: 'urn:profile:test.EntityEvent:1.0.0',
            },
          },
        }),
      ],
    },
  ])
}
