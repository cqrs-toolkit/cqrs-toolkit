import crypto from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { BuildResult } from './HydraBuilder.js'
import { stableOrder } from './HydraBuilder.js'

export interface ResolvedSchemaBundle {
  apidoc: {
    /** Compact canonical JSON (sorted keys, no indentation) */
    content: string
    /** SHA-256 hex digest of content */
    etag: string
  }
  /** Resolved schema files keyed by relative serve path (e.g. "schemas/urn/schema/...json") */
  schemas: ReadonlyMap<string, string>
}

/** Convert a URN to a dereferenceable schema URL. */
export function urnToSchemaUrl(docsEntrypoint: string, urn: string): string {
  return `${docsEntrypoint}/schemas/${urn.replaceAll(':', '/')}.json`
}

/** Convert a `urn:vocab:${name}#` to a dereferenceable vocab URL. */
export function urnToVocabUrl(docsEntrypoint: string, urn: string): string {
  // urn:vocab:chat# → ${docsEntrypoint}/vocab/chat#
  const suffix = urn.slice('urn:vocab:'.length)
  return `${docsEntrypoint}/vocab/${suffix}`
}

/**
 * Resolve a schema bundle from an in-memory BuildResult.
 * Transforms URN-based `$id`, `$ref`, and `svc:jsonSchema` values to dereferenceable URLs.
 * Produces compact canonical JSON with a SHA-256 ETag.
 */
export function resolveSchemaBundle(opts: {
  buildResult: BuildResult
  docsEntrypoint: string
  apiEntrypoint: string
}): ResolvedSchemaBundle {
  const { buildResult, docsEntrypoint, apiEntrypoint } = opts

  const resolvedJsonld = resolveApidocUrns(buildResult.jsonld, docsEntrypoint, apiEntrypoint)
  const compactContent = JSON.stringify(stableOrder(resolvedJsonld))
  const etag = computeEtag(compactContent)

  const schemas = new Map<string, string>()
  for (const [path, entry] of buildResult.schemas) {
    const parsed = JSON.parse(entry.content) as unknown
    const resolved = resolveSchemaUrns(parsed, docsEntrypoint)
    schemas.set(path, JSON.stringify(stableOrder(resolved)))
  }

  return { apidoc: { content: compactContent, etag }, schemas }
}

/**
 * Load committed schema artifacts from disk and resolve URNs to dereferenceable URLs.
 * Reads `apidoc.jsonld` and all `.json` files under `schemas/` from `sourceDir`.
 */
export function loadSchemaBundle(opts: {
  sourceDir: string
  docsEntrypoint: string
  apiEntrypoint: string
}): ResolvedSchemaBundle {
  const { sourceDir, docsEntrypoint, apiEntrypoint } = opts

  const rawApidoc = readFileSync(join(sourceDir, 'apidoc.jsonld'), 'utf-8')
  const apidocJson = JSON.parse(rawApidoc) as unknown
  const resolvedJsonld = resolveApidocUrns(apidocJson, docsEntrypoint, apiEntrypoint)
  const compactContent = JSON.stringify(stableOrder(resolvedJsonld))
  const etag = computeEtag(compactContent)

  const schemas = new Map<string, string>()
  const schemasDir = join(sourceDir, 'schemas')
  const files = readdirSync(schemasDir, { recursive: true, encoding: 'utf-8' })
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const relativePath = `schemas/${file}`
    const raw = readFileSync(join(schemasDir, file), 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    const resolved = resolveSchemaUrns(parsed, docsEntrypoint)
    schemas.set(relativePath, JSON.stringify(stableOrder(resolved)))
  }

  return { apidoc: { content: compactContent, etag }, schemas }
}

/** Write a resolved schema bundle to a target directory. */
export function writeSchemaBundle(bundle: ResolvedSchemaBundle, outputDir: string): void {
  mkdirSync(outputDir, { recursive: true })
  writeFileSync(join(outputDir, 'apidoc.jsonld'), bundle.apidoc.content)
  writeFileSync(join(outputDir, 'apidoc.jsonld.etag'), bundle.apidoc.etag)

  for (const [relativePath, content] of bundle.schemas) {
    const filePath = join(outputDir, relativePath)
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, content)
  }
}

// ---- Private helpers ----

function computeEtag(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

/** Walk apidoc JSON-LD and rewrite URN values to dereferenceable URLs. */
function resolveApidocUrns(value: unknown, docsEntrypoint: string, apiEntrypoint: string): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => resolveApidocUrns(v, docsEntrypoint, apiEntrypoint))
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
      } else if (k === 'svc:jsonSchema' && typeof v === 'string' && v.startsWith('urn:')) {
        out[k] = urnToSchemaUrl(docsEntrypoint, v)
      } else {
        out[k] = resolveApidocUrns(v, docsEntrypoint, apiEntrypoint)
      }
    }
    return out
  }
  return value
}

/** Walk a JSON Schema and rewrite `$id` and `$ref` URN values to URLs. */
function resolveSchemaUrns(value: unknown, docsEntrypoint: string): unknown {
  if (Array.isArray(value)) return value.map((v) => resolveSchemaUrns(v, docsEntrypoint))
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if ((k === '$id' || k === '$ref') && typeof v === 'string' && v.startsWith('urn:')) {
        out[k] = urnToSchemaUrl(docsEntrypoint, v)
      } else {
        out[k] = resolveSchemaUrns(v, docsEntrypoint)
      }
    }
    return out
  }
  return value
}
