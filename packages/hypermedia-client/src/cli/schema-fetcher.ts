/**
 * Download JSON schemas by URL, including transitive $ref dependencies.
 */

import type { ParsedCommand } from './apidoc-parser.js'

export interface FetchedSchema {
  /** Command name key (matches ParseResult.commands key) */
  name: string
  /** Schema URL (from the command's svc:jsonSchema) */
  url: string
  /** Raw JSON schema content */
  content: string
}

export interface FetchedCommonSchema {
  /** Derived file name (e.g., 'UpdateNoteTitleData') */
  name: string
  /** Schema $id URL */
  id: string
  /** Raw JSON schema content */
  content: string
}

export interface FetchSchemasResult {
  /** Command schemas keyed by command name */
  commands: FetchedSchema[]
  /** Transitive $ref dependency schemas */
  common: FetchedCommonSchema[]
}

/**
 * Fetch all JSON schemas referenced by parsed commands, plus transitive $ref dependencies.
 * Skips commands that have no schemaUrl.
 */
export async function fetchSchemas(
  commands: Map<string, ParsedCommand>,
): Promise<FetchSchemasResult> {
  const entries: { name: string; url: string }[] = []
  for (const [name, cmd] of commands) {
    if (cmd.schemaUrl) {
      entries.push({ name, url: cmd.schemaUrl })
    }
  }

  // Fetch command schemas
  const commandSchemas = await Promise.all(
    entries.map(async (entry) => {
      const res = await fetch(entry.url)
      if (!res.ok) {
        throw new Error(`Failed to fetch schema ${entry.url}: ${res.status} ${res.statusText}`)
      }
      const content = await res.text()
      return { name: entry.name, url: entry.url, content }
    }),
  )

  // Crawl $ref dependencies from all command schemas
  const fetchedUrls = new Set(commandSchemas.map((s) => s.url))
  const commonSchemas: FetchedCommonSchema[] = []
  const pendingRefs = new Set<string>()

  // Collect initial $refs from command schemas
  for (const schema of commandSchemas) {
    for (const ref of extractRefs(schema.content)) {
      if (!fetchedUrls.has(ref)) {
        pendingRefs.add(ref)
      }
    }
  }

  // Transitive closure: fetch referenced schemas and their refs
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

    for (const { url, content } of fetched) {
      fetchedUrls.add(url)
      const name = deriveNameFromUrl(url)
      commonSchemas.push({ name, id: url, content })

      // Check for further $refs
      for (const ref of extractRefs(content)) {
        if (!fetchedUrls.has(ref)) {
          pendingRefs.add(ref)
        }
      }
    }
  }

  return { commands: commandSchemas, common: commonSchemas }
}

/**
 * Extract all $ref URLs from a JSON schema string.
 * Only follows HTTP(S) URLs, not local fragment refs.
 */
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

/**
 * Derive a TypeScript-friendly name from a schema URL.
 * e.g., ".../demo.UpdateNoteTitleData/1.0.0.json" → "UpdateNoteTitleData"
 */
function deriveNameFromUrl(url: string): string {
  const path = new URL(url).pathname
  // Pattern: /schemas/urn/schema/demo.SomeName/version.json
  const match = path.match(/\/([^/]+)\/\d+\.\d+\.\d+\.json$/)
  if (match && match[1]) {
    const fullName = match[1]
    // Strip namespace prefix (e.g., "demo.UpdateNoteTitleData" → "UpdateNoteTitleData")
    const dotIndex = fullName.lastIndexOf('.')
    return dotIndex >= 0 ? fullName.substring(dotIndex + 1) : fullName
  }
  // Fallback: use last path segment without extension
  const segments = path.split('/')
  const last = segments[segments.length - 1] ?? 'Unknown'
  return last.replace(/\.json$/, '')
}
