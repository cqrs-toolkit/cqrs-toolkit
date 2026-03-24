/**
 * Shared command infrastructure for the hypermedia demo server.
 *
 * Mirrors the production `command-server-utils.ts` pattern but with a flat
 * command envelope: `{ type, data, revision }` instead of `{ command: { type, data, revision } }`.
 */

import type { CommandSuccessResponse } from '@cqrs-toolkit/demo-base/common/shared'
import type { HydraDoc } from '@cqrs-toolkit/hypermedia'
import type { CommandDispatchExtractor } from '@cqrs-toolkit/hypermedia/server'
import type { IEvent, ISerializedEvent, Persisted } from '@meticoeus/ddd-es'
import type { FastifySchema, RouteShorthandOptions } from 'fastify'
import type { JSONSchema7 } from 'json-schema'
import assert from 'node:assert'

// ---------------------------------------------------------------------------
// Schema builders (mirrors production buildCommandSchema / addCommandCapabilitySchema)
// ---------------------------------------------------------------------------

/**
 * Build a JSON schema for the flat command envelope: `{ type, data, revision? }`.
 */
export function buildCommandSchema(commandType: string, dataSchema: JSONSchema7): JSONSchema7 {
  return {
    type: 'object',
    required: ['type', 'data'],
    additionalProperties: false,
    properties: {
      type: { type: 'string', const: commandType },
      data: dataSchema,
      revision: { type: 'string' },
    },
  }
}

function parseVersionFromId(id: string): string {
  const parts = id.split(':')
  const version = parts[parts.length - 1]
  assert(version, `Could not parse version from command id: ${id}`)
  return version
}

function toSchemaUrn(commandId: string): string {
  return commandId.replace(/urn:command:/, 'urn:schema:')
}

function toDataSchemaUrn(commandId: string): string {
  const schemaUrn = toSchemaUrn(commandId)
  const parts = schemaUrn.split(':')
  assert(parts.length === 4, `Invalid command id: ${commandId}`)
  const nameSegment = parts[2]
  assert(typeof nameSegment === 'string')
  const dotIndex = nameSegment.lastIndexOf('.')
  assert(dotIndex !== -1)
  const prefix = nameSegment.slice(0, dotIndex + 1)
  const name = nameSegment.slice(dotIndex + 1)
  return `urn:schema:${prefix}${name}Data:${parts[3]}`
}

/**
 * Set schema + $id for a create-surface command capability.
 * The body IS the data directly — no envelope wrapping.
 *
 * Derives `version` from the capability's `id` URN.
 */
export function addBodyCommandSchema<Ext extends string>(
  dataSchema: JSONSchema7,
  cap: Omit<HydraDoc.PlainCommonCommandCapability<Ext>, 'schema' | 'version'>,
): HydraDoc.PlainCommonCommandCapability<Ext> {
  if (!dataSchema.$id) {
    dataSchema.$id = toSchemaUrn(cap.id)
  }
  return Object.assign(cap, { schema: dataSchema, version: parseVersionFromId(cap.id) })
}

/**
 * Wrap a data schema in the flat command envelope and set $id for a command-surface capability.
 *
 * Derives `version` from the capability's `id` URN.
 */
export function addCommandCapabilitySchema<Ext extends string>(
  dataSchema: JSONSchema7,
  cap: Omit<HydraDoc.PlainCommonCommandCapability<Ext>, 'schema' | 'version'>,
): HydraDoc.PlainCommonCommandCapability<Ext> {
  assert(cap.commandType, 'May only be called with a commandType')
  if (!dataSchema.$id) {
    dataSchema.$id = toDataSchemaUrn(cap.id)
  }
  const schema = buildCommandSchema(cap.commandType, dataSchema)
  schema.$id = toSchemaUrn(cap.id)

  return Object.assign(cap, { schema: schema, version: parseVersionFromId(cap.id) })
}

// ---------------------------------------------------------------------------
// Command envelope extractor
// ---------------------------------------------------------------------------

/**
 * Extracts the validation schema for CommandPlanner.
 *
 * - Create surface: the full schema IS the data schema
 * - Command envelope surface: navigate to `schema.properties.data`
 */
export const COMMAND_ENVELOPE_EXTRACTOR: CommandDispatchExtractor = {
  getValidationSchema(cap) {
    assert(cap.schema, `getValidationSchema: capability ${cap.id} must have a schema`)
    if (cap.dispatch === 'create') {
      return cap.schema
    }
    const dataProp = cap.schema.properties?.['data']
    assert(typeof dataProp === 'object' && !Array.isArray(dataProp))
    return dataProp as JSONSchema7
  },
}

// ---------------------------------------------------------------------------
// Network-edge AJV schemas (Fastify schema validation)
// ---------------------------------------------------------------------------

const responseSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    nextExpectedRevision: { type: 'string' },
    events: { type: 'array' },
    message: { type: 'string' },
    details: {},
  },
}

export const createSchema: FastifySchema = {
  body: {
    type: 'object',
  },
  response: {
    200: responseSchema,
  },
}

export const commandSchema: FastifySchema = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['type', 'data'],
    properties: {
      type: { type: 'string' },
      data: { type: 'object' },
      revision: { type: 'string' },
    },
  },
  response: {
    200: responseSchema,
  },
}

export const createRouteConfig: RouteShorthandOptions = {
  schema: createSchema,
}

export const commandRouteConfig: RouteShorthandOptions = {
  schema: commandSchema,
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

export function toSerializedEvent(event: Persisted<IEvent>): ISerializedEvent {
  return {
    streamId: event.streamId,
    id: event.id,
    revision: String(event.revision),
    position: String(event.position),
    type: event.type,
    data: event.data,
    metadata: event.metadata,
    created: event.created,
  }
}

export function toCommandSuccess(
  aggregateId: string,
  nextExpectedRevision: bigint,
  events: Persisted<IEvent>[],
): CommandSuccessResponse {
  return {
    id: aggregateId,
    nextExpectedRevision: String(nextExpectedRevision),
    events: events.map((e) => toSerializedEvent(e)),
  }
}
