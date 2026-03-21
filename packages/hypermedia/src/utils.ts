import assert from 'node:assert'
import type { HydraDoc } from './HydraDoc.js'

// private utilities. do not export from local index.ts

/**
 * Builds an RFC 6570 (level 1) URI Template IRI:
 *   /path{?a,b,c}
 *
 * - Preserves the given path fragment exactly.
 * - If `params` is omitted or empty, returns just the path.
 * - Deduplicates parameters while preserving first-seen order.
 */
export function buildTemplateIri(
  pathFragment: `/${string}`,
  params?: readonly string[],
): `/${string}` {
  if (!params || params.length === 0) {
    return pathFragment
  }

  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const p of params) {
    if (seen.has(p)) {
      duplicates.add(p)
    } else {
      seen.add(p)
    }
  }

  assert(
    duplicates.size === 0,
    `buildTemplateIri(${pathFragment}): duplicate query parameter(s): ${[...duplicates].join(', ')}. ` +
      `Each parameter may only appear once when generating a URI template.`,
  )

  return `${pathFragment}{?${params.join(',')}}`
}

export function assertNoQueryExpansionInTemplate(id: string, template: string): void {
  assert(
    !template.includes('{?'),
    `HydraDoc migration: template "${id}" must NOT include an RFC6570 query expansion ("{?...}"). ` +
      `Provide only the base path template (e.g. "/api/foo" or "/api/foo/{id}") and let ` +
      `HydraDoc derive "{?...}" from mappings[].variable order.\n` +
      `Found: ${template}`,
  )
}

export function deriveQueryVarsFromMappings(
  template: string,
  mappings: readonly HydraDoc.IriTemplateMapping[],
): string[] {
  const pathVars = getPathVariablesFromTemplate(template)

  const seen = new Set<string>()
  const duplicates = new Set<string>()
  const vars: string[] = []

  for (const m of mappings) {
    const v = m.variable
    if (!v) continue

    // Do not include variables already used as path tokens in the template.
    if (pathVars.has(v)) continue

    if (seen.has(v)) duplicates.add(v)
    else {
      seen.add(v)
      vars.push(v) // preserve mapping order
    }
  }

  assert(
    duplicates.size === 0,
    `HydraDoc: duplicate mappings[].variable for template "${template}": ${[...duplicates].join(', ')}. ` +
      `Each mapping.variable must be unique.`,
  )

  return vars
}

function getPathVariablesFromTemplate(template: string): Set<string> {
  // Matches "{id}" occurrences (NOT "{?a,b}")
  const vars = new Set<string>()
  const re = /\{([^\}?][^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(template))) {
    const v = m[1]
    if (v !== undefined) {
      vars.add(v)
    }
  }
  return vars
}

export function semverDesc(a: string, b: string) {
  const pa = a.split('.').map(Number),
    pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pb[i] ?? 0) - (pa[i] ?? 0)
    if (d) return d
  }
  return 0
}

export interface ReqLike {
  method?: string
  headers: Record<string, string | string[] | undefined>
}

export function deriveRequestedProfilesRaw(req: ReqLike): string[] | null {
  const method = (req.method || 'GET').toUpperCase()
  const out: string[] = []

  if (method === 'GET' || method === 'HEAD') {
    const ap = headerRaw(req, 'accept-profile')
    if (ap) out.push(...splitCsv(ap))

    const accept = headerRaw(req, 'accept')
    if (accept) out.push(...extractProfileParams(accept))
  } else {
    const cp = headerRaw(req, 'content-profile')
    if (cp) out.push(...splitCsv(cp))

    const ct = headerRaw(req, 'content-type')
    if (ct) out.push(...extractProfileParams(ct))
  }

  return out.length ? dedupe(out) : null
}

export function hasExplicitReadProfileRaw(req: ReqLike): boolean {
  const ap = headerRaw(req, 'accept-profile')
  if (ap && splitCsv(ap).length) return true

  const accept = headerRaw(req, 'accept')
  return Boolean(accept && extractProfileParams(accept).length)
}

export function hasExplicitWriteProfileRaw(req: ReqLike): boolean {
  const cp = headerRaw(req, 'content-profile')
  if (cp && splitCsv(cp).length) return true

  const ct = headerRaw(req, 'content-type')
  return Boolean(ct && extractProfileParams(ct).length)
}

function headerRaw(req: ReqLike, name: string): string | null {
  const n1 = name.toLowerCase()
  const n2 = n1.replace(/-/g, '_') // some proxies/clients use underscores
  const v = req.headers?.[n1] ?? req.headers?.[n2]
  if (v == null) return null
  return Array.isArray(v) ? v.join(',') : v
}

function splitCsv(s: string): string[] {
  // Split on commas, trim, and strip optional surrounding quotes.
  return s
    .split(',')
    .map((v) => v.trim().replace(/^"|"$/g, ''))
    .filter(Boolean)
}

function extractProfileParams(v: string): string[] {
  // Accept both quoted and unquoted: profile="urn:..." or profile=urn:...
  const rx = /profile\s*=\s*(?:"([^"]*)"|([^;,()\s]+))/gi
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = rx.exec(v)) !== null) {
    const s = (m[1] ?? m[2] ?? '').trim()
    if (s) out.push(s)
  }
  return out
}

function dedupe<T>(arr: T[]): T[] {
  const seen = new Set<T>()
  const out: T[] = []
  for (const v of arr)
    if (!seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  return out
}

// Utility: convert RFC6570 path vars `{param}` → colon params `:param`
// (Assumes `path` has no query-expansion suffix; Surface.hrefBase already strips `{?...}`.)
export function uriTemplatePathToColon(path: string): string {
  return path.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, ':$1')
}
