import type { JSONSchema7 } from 'json-schema'
import { HydraDoc } from '../HydraDoc.js'

export const PREFIXES = ['test', 'svc']

export const RENAME_SCHEMA: JSONSchema7 = {
  $id: 'urn:schema:test.RenameItem:1.0.0',
  type: 'object',
  properties: { name: { type: 'string', minLength: 1 } },
  required: ['name'],
  additionalProperties: false,
}

export const PERMIT_RESPONSE_SCHEMA: JSONSchema7 = {
  $id: 'urn:schema:test.PermitResponse:1.0.0',
  type: 'object',
  properties: {
    id: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        uploadForm: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            fields: { type: 'object' },
          },
          required: ['url', 'fields'],
        },
      },
      required: ['uploadForm'],
    },
  },
  required: ['id', 'data'],
}

export function minimalRepresentation(): HydraDoc.Representation {
  return new HydraDoc.Representation({
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
  })
}

export function makeClassDef(commands: HydraDoc.PlainCommandsDef<never>): HydraDoc.ClassDef {
  return {
    class: 'test:Entity',
    commands: new HydraDoc.CommandsDef(commands),
    representations: [minimalRepresentation()],
  }
}
