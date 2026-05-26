/**
 * Download JSON schemas by URL, including transitive $ref dependencies.
 *
 * Three buckets:
 * - `commands`: request-body schemas for parsed commands (`cmd.schemaUrl`).
 * - `responses`: response-body schemas from commands' `responseSchema[]` and
 *   from representations' per-surface response schemas.
 * - `common`: transitive `$ref` targets reached from any of the above that
 *   aren't already in commands/responses.
 *
 * Buckets are URL-disjoint: a URL appears in at most one bucket
 * (commands wins over responses wins over common).
 */

import type { ParsedCommand } from './apidoc-parser.js'
import type { RepresentationResponseSchemas } from './apidoc-representations.js'

export interface FetchedSchema {
  /** Identifier derived from URL — used as the filename for `<name>.json`. */
  name: string
  /** Source URL. */
  url: string
  /** Raw JSON schema content. */
  content: string
}

export interface FetchedCommonSchema {
  /** Derived file name (e.g. `UpdateNoteTitleData`). */
  name: string
  /** Schema `$id` URL. */
  id: string
  /** Raw JSON schema content. */
  content: string
}

export interface FetchSchemasResult {
  commands: FetchedSchema[]
  responses: FetchedSchema[]
  common: FetchedCommonSchema[]
}

/**
 * Fetch all JSON schemas for the supplied commands and representations,
 * plus the transitive `$ref` closure reached from them.
 *
 * The second argument (representation response schemas keyed by class @id)
 * may be omitted by callers that only have commands to pull.
 */
export async function fetchSchemas(
  commands: Map<string, ParsedCommand>,
  representationResponseSchemas: Record<string, RepresentationResponseSchemas> = {},
): Promise<FetchSchemasResult> {
  const commandEntries: { name: string; url: string }[] = []
  for (const [name, cmd] of commands) {
    if (cmd.schemaUrl) commandEntries.push({ name, url: cmd.schemaUrl })
  }

  const responseEntries = collectResponseEntries(commands, representationResponseSchemas)
  const commandUrls = new Set(commandEntries.map((e) => e.url))
  const dedupedResponses = dedupByUrlExcluding(responseEntries, commandUrls)

  const commandSchemas = await Promise.all(
    commandEntries.map(async (entry) => fetchOne(entry.url, entry.name)),
  )

  const responseSchemas = await Promise.all(
    dedupedResponses.map(async (entry) => fetchOne(entry.url, entry.name)),
  )

  const intentionalUrls = new Set<string>([
    ...commandSchemas.map((s) => s.url),
    ...responseSchemas.map((s) => s.url),
  ])

  const commonSchemas: FetchedCommonSchema[] = []
  const pendingRefs = new Set<string>()
  for (const schema of [...commandSchemas, ...responseSchemas]) {
    for (const ref of extractRefs(schema.content)) {
      if (!intentionalUrls.has(ref)) pendingRefs.add(ref)
    }
  }

  while (pendingRefs.size > 0) {
    const batch = [...pendingRefs]
    pendingRefs.clear()

    const fetched = await Promise.all(
      batch.map(async (url) => {
        const res = await fetch(url)
        if (!res.ok) {
          throw new Error(`Failed to fetch $ref schema ${url}: ${res.status} ${res.statusText}`)
        }
        return { url, content: await res.text() }
      }),
    )

    // Mark every URL in this batch as fetched before walking refs. Otherwise
    // a schema iterated early in the batch that references another schema
    // iterated later in the same batch would re-queue that peer for the next
    // outer iteration (its `intentionalUrls.add` hasn't happened yet),
    // fetching and pushing it twice.
    for (const { url } of fetched) {
      intentionalUrls.add(url)
    }

    for (const { url, content } of fetched) {
      const name = deriveNameFromUrl(url)
      commonSchemas.push({ name, id: url, content })

      for (const ref of extractRefs(content)) {
        if (!intentionalUrls.has(ref)) pendingRefs.add(ref)
      }
    }
  }

  return { commands: commandSchemas, responses: responseSchemas, common: commonSchemas }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function fetchOne(url: string, name: string): Promise<FetchedSchema> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch schema ${url}: ${res.status} ${res.statusText}`)
  }
  return { name, url, content: await res.text() }
}

const HAL_CONTENT_TYPE = 'application/hal+json'

/**
 * Choose the schemas to emit types for from a per-surface
 * `responseSchema[]` array.
 *
 * Default behaviour: when the server advertises HAL support
 * (`application/hal+json`), use ONLY the HAL variant and skip the plain
 * JSON twin. HAL and JSON variants commonly share the same `title`, and
 * we'd rather emit one representation as the canonical form than collide.
 *
 * When HAL is absent, all advertised content-types pass through; the
 * caller deduplicates by URL.
 */
function selectPreferredResponseSchemas(
  schemas: readonly { contentType: string; schemaUrl: string }[],
): readonly { contentType: string; schemaUrl: string }[] {
  const hal = schemas.filter((s) => s.contentType === HAL_CONTENT_TYPE)
  return hal.length > 0 ? hal : schemas
}

function collectResponseEntries(
  commands: Map<string, ParsedCommand>,
  representationResponseSchemas: Record<string, RepresentationResponseSchemas>,
): { name: string; url: string }[] {
  const out: { name: string; url: string }[] = []
  for (const [, cmd] of commands) {
    if (!cmd.responseSchema) continue
    for (const rs of selectPreferredResponseSchemas(cmd.responseSchema)) {
      out.push({ name: deriveNameFromUrl(rs.schemaUrl), url: rs.schemaUrl })
    }
  }
  for (const byClass of Object.values(representationResponseSchemas)) {
    for (const schemas of Object.values(byClass)) {
      if (!schemas) continue
      for (const rs of selectPreferredResponseSchemas(schemas)) {
        out.push({ name: deriveNameFromUrl(rs.schemaUrl), url: rs.schemaUrl })
      }
    }
  }
  return out
}

function dedupByUrlExcluding(
  entries: { name: string; url: string }[],
  excludeUrls: ReadonlySet<string>,
): { name: string; url: string }[] {
  const seen = new Set<string>()
  return entries.filter((e) => {
    if (excludeUrls.has(e.url) || seen.has(e.url)) return false
    seen.add(e.url)
    return true
  })
}

function extractRefs(schemaJson: string): string[] {
  const schema: unknown = JSON.parse(schemaJson)
  const refs: string[] = []
  walkRefs(schema, refs)
  return refs
}

function walkRefs(node: unknown, refs: string[]): void {
  if (typeof node !== 'object' || node === null) return
  if (Array.isArray(node)) {
    for (const item of node) {
      walkRefs(item, refs)
    }
    return
  }
  const obj = node as Record<string, unknown>
  if (typeof obj['$ref'] === 'string' && obj['$ref'].startsWith('http')) {
    refs.push(obj['$ref'])
  }
  for (const value of Object.values(obj)) {
    walkRefs(value, refs)
  }
}

function deriveNameFromUrl(url: string): string {
  const path = new URL(url).pathname
  const match = path.match(/\/([^/]+)\/\d+\.\d+\.\d+\.json$/)
  if (match && match[1]) {
    const fullName = match[1]
    const dotIndex = fullName.lastIndexOf('.')
    return dotIndex >= 0 ? fullName.substring(dotIndex + 1) : fullName
  }
  const segments = path.split('/')
  const last = segments[segments.length - 1] ?? 'Unknown'
  return last.replace(/\.json$/, '')
}
