import { JSONSchema7 } from 'json-schema'
import { HydraDoc } from './HydraDoc.js'

export const RENAME_SCHEMA: JSONSchema7 = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
  },
  required: ['name'],
  additionalProperties: false,
}

export const RENAME_V2_SCHEMA: JSONSchema7 = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    reason: { type: 'string' },
  },
  required: ['name'],
  additionalProperties: false,
}

export const CREATE_SCHEMA: JSONSchema7 = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
  },
  required: ['name'],
  additionalProperties: false,
}

export const INT64_SCHEMA: JSONSchema7 = {
  type: 'string',
  format: 'int64',
}

export const REVISION_SCHEMA: JSONSchema7 = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    revision: INT64_SCHEMA,
    metadata: {
      type: 'object',
      properties: {
        timestamp: { type: 'string' },
      },
      required: ['timestamp'],
      additionalProperties: false,
    },
  },
  required: ['name', 'revision', 'metadata'],
  additionalProperties: false,
}

export function resourceSurface(
  overrides: Partial<HydraDoc.ResourceSurface> = {},
): HydraDoc.ResourceSurface {
  return {
    formats: ['application/json'],
    profile: 'urn:profile:test.Item:1.0.0',
    template: {
      id: 'test-resource',
      template: '/api/items/{id}',
      mappings: [{ variable: 'id', property: 'id', required: true }],
    },
    ...overrides,
  }
}

export function collectionSurface(
  overrides: Partial<HydraDoc.CollectionSurface> = {},
): HydraDoc.CollectionSurface {
  return {
    formats: ['application/json'],
    profile: 'urn:profile:test.ItemCollection:1.0.0',
    href: '/api/items',
    template: {
      id: 'test-collection',
      template: '/api/items',
      mappings: [
        { variable: 'q', property: 'q' },
        { variable: 'limit', property: 'limit' },
        { variable: 'cursor', property: 'cursor' },
      ],
    },
    ...overrides,
  }
}

export function plainRepresentation(
  overrides: Partial<HydraDoc.PlainRepresentation> = {},
): HydraDoc.PlainRepresentation {
  return {
    id: '#test-item-v1_0_0',
    version: '1.0.0',
    resource: resourceSurface(),
    collection: collectionSurface(),
    ...overrides,
  }
}

export function singleVersionDef(): HydraDoc.CommandsDef<never> {
  return new HydraDoc.CommandsDef<never>({
    surfaces: HydraDoc.standardCommandSurfaces({
      idStem: '#test',
      collectionHref: '/api/test/items',
      idProperty: 'test:itemId',
    }),
    commands: [
      {
        id: 'urn:command:test.CreateItem:1.0.0',
        stableId: 'test.CreateItem',
        dispatch: 'create',
        schema: CREATE_SCHEMA,
      },
      {
        id: 'urn:command:test.RenameItem:1.0.0',
        stableId: 'test.RenameItem',
        dispatch: 'command',
        commandType: 'rename',
        schema: RENAME_SCHEMA,
      },
    ],
  })
}

export function multiVersionDef(): HydraDoc.CommandsDef<never> {
  return new HydraDoc.CommandsDef<never>({
    surfaces: HydraDoc.standardCommandSurfaces({
      idStem: '#test',
      collectionHref: '/api/test/items',
      idProperty: 'test:itemId',
    }),
    commands: [
      {
        id: 'urn:command:test.RenameItem:1.0.0',
        stableId: 'test.RenameItem',
        dispatch: 'command',
        commandType: 'rename',
        adapt: (data: unknown) => {
          // v1 → v2: add default reason field
          const d = data as Record<string, unknown>
          return { ...d, reason: 'migrated from v1' }
        },
      },
      {
        id: 'urn:command:test.RenameItem:2.0.0',
        stableId: 'test.RenameItem',
        dispatch: 'command',
        commandType: 'rename',
        schema: RENAME_V2_SCHEMA,
      },
      {
        id: 'urn:command:test.CreateItem:1.0.0',
        stableId: 'test.CreateItem',
        dispatch: 'create',
        schema: CREATE_SCHEMA,
      },
    ],
  })
}

export function hydrationDef(): HydraDoc.CommandsDef<never> {
  return new HydraDoc.CommandsDef<never>({
    surfaces: HydraDoc.standardCommandSurfaces({
      idStem: '#test',
      collectionHref: '/api/test/items',
      idProperty: 'test:itemId',
    }),
    commands: [
      {
        id: 'urn:command:test.UpdateItem:1.0.0',
        stableId: 'test.UpdateItem',
        dispatch: 'command',
        commandType: 'update',
        schema: REVISION_SCHEMA,
        hydrate: (data: unknown) => {
          const d = data as { metadata: { timestamp: string | Date } }
          d.metadata.timestamp = new Date(d.metadata.timestamp)
        },
      },
    ],
  })
}
