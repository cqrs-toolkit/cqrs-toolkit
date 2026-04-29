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

/**
 * Build a minimal {@link HydraDoc.ViewRepresentation} bound to {@link minimalRepresentation}.
 * Intended for testing `supportedProperties` wiring on a parent ClassDef whose own
 * tests do not register the base representation themselves.
 */
export function minimalView(
  overrides: {
    id?: string
    version?: string
    template?: `/${string}`
    profile?: string
    operationId?: string
  } = {},
): HydraDoc.ViewRepresentation {
  const id = overrides.id ?? '#test-parent-children-view-v1_0_0'
  const template: `/${string}` = overrides.template ?? '/api/test/parents/{id}/children'
  return new HydraDoc.ViewRepresentation({
    id,
    version: overrides.version ?? '1.0.0',
    base: minimalRepresentation(),
    collection: {
      profile: overrides.profile ?? 'urn:profile:test.ParentChildren:1.0.0',
      formats: ['application/json'],
      operationId: overrides.operationId ?? 'getParentChildren',
      href: template,
      template: {
        id: `${id}-collection`,
        template,
        mappings: [
          { variable: 'id', property: 'test:parentId', required: true },
          { variable: 'q', property: 'svc:query' },
        ],
      },
    },
  })
}

/**
 * Build a minimal {@link HydraDoc.OperationLink} bound to {@link minimalRepresentation}.
 * Models a single-resource templated operation (no query expansion required).
 */
export function minimalOperationLink(
  overrides: {
    id?: string
    version?: string
    template?: `/${string}`
    profile?: string
    operationId?: string
  } = {},
): HydraDoc.OperationLink {
  const id = overrides.id ?? '#test-entity-action-v1_0_0'
  const template: `/${string}` = overrides.template ?? '/api/test/entities/{id}/action'
  return new HydraDoc.OperationLink({
    id,
    version: overrides.version ?? '1.0.0',
    operation: {
      profile: overrides.profile ?? 'urn:profile:test.EntityAction:1.0.0',
      formats: ['application/json'],
      operationId: overrides.operationId ?? 'entityAction',
      template: {
        id: `${id}-surface`,
        template,
        mappings: [{ variable: 'id', property: 'test:entityId', required: true }],
      },
    },
  })
}
