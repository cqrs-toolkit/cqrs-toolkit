import crypto from 'node:crypto'
import type { SchemaUrnResolver } from '../cli/config-types.js'
import { urnToVocabUrl } from './resolve.js'

export function computeEtag(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

export type SchemaUrnToUrlMapper = (urn: string) => string

export function buildSchemaUrnToUrlMapper(
  docsEntrypoint: string,
  schemaUrnResolver: SchemaUrnResolver | undefined,
): SchemaUrnToUrlMapper {
  if (!schemaUrnResolver) return (urn) => urn

  const segment = normalizePathSegment(schemaUrnResolver.pathSegment)
  const schemaBasePath = `${docsEntrypoint}/${segment}/`
  return (urn) => schemaBasePath + schemaUrnResolver.mapUrnToUrl(urn)
}

export function normalizePathSegment(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/, '')
}

/**
 * Walk a JSON Schema and rewrite `$id` and `$ref` URN values to URLs.
 * Captures each `$id` URN → URL mapping into urnMap.
 */
export function resolveSchemaUrns(
  value: unknown,
  opts: {
    urnMap: Map<string, string>
    schemaUrnResolver: SchemaUrnResolver
    schemaUrnToUrlMapper: SchemaUrnToUrlMapper
  },
): unknown {
  const { urnMap, schemaUrnResolver, schemaUrnToUrlMapper } = opts
  if (Array.isArray(value)) return value.map((v) => resolveSchemaUrns(v, opts))
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if ((k === '$id' || k === '$ref') && typeof v === 'string' && schemaUrnResolver.isUrn(v)) {
        const url = schemaUrnToUrlMapper(v)
        if (k === '$id') {
          urnMap.set(v, url)
        }
        out[k] = url
      } else {
        out[k] = resolveSchemaUrns(v, opts)
      }
    }
    return out
  }
  return value
}

/** Walk apidoc JSON-LD and rewrite URN values to dereferenceable URLs. */
export function resolveApidocUrns(
  value: unknown,
  opts: {
    docsEntrypoint: string
    apiEntrypoint: string
    schemaUrnResolver: SchemaUrnResolver | undefined
    schemaUrnToUrlMapper: SchemaUrnToUrlMapper
  },
): unknown {
  const { docsEntrypoint, apiEntrypoint, schemaUrnResolver, schemaUrnToUrlMapper } = opts
  if (Array.isArray(value)) {
    return value.map((v) => resolveApidocUrns(v, opts))
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (k === '@id' && v === 'urn:apidoc') {
        out[k] = `${docsEntrypoint}/apidoc`
      } else if (k === '@id' && v === 'urn:entrypoint') {
        out[k] = apiEntrypoint
      } else if (typeof v === 'string' && v.startsWith('urn:vocab:')) {
        out[k] = urnToVocabUrl(docsEntrypoint, v)
      } else if (k === 'svc:jsonSchema' && typeof v === 'string' && schemaUrnResolver?.isUrn(v)) {
        out[k] = schemaUrnToUrlMapper(v)
      } else {
        out[k] = resolveApidocUrns(v, opts)
      }
    }
    return out
  }
  return value
}

/**
 * Walk an OpenAPI document and rewrite `$ref` URN values to URLs
 * using the known schema URN→URL map built during schema resolution.
 */
export function resolveOpenApiUrns(
  value: unknown,
  schemaUrns: ReadonlyMap<string, string>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => resolveOpenApiUrns(v, schemaUrns))
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (k === '$ref' && typeof v === 'string') {
        const url = schemaUrns.get(v)
        out[k] = url ?? v
      } else {
        out[k] = resolveOpenApiUrns(v, schemaUrns)
      }
    }
    return out
  }
  return value
}
