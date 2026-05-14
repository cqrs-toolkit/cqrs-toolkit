/**
 * Reusable fetch helpers for hypermedia-formatted event and record endpoints.
 *
 * Handles Accept header, response parsing, and hydration.
 * Used internally by createCollection and exported for consumers who want full control.
 */

import {
  hydrateSerializedEvent,
  type FetchContext,
  type IPersistedEvent,
  type ISerializedEvent,
  type JSONPathExpression,
  type SeedEventPage,
  type SeedRecord,
  type SeedRecordPage,
} from '@cqrs-toolkit/client'

/**
 * Fetch a page of events from a hypermedia-formatted aggregate events endpoint.
 *
 * @param ctx - Fetch context with baseUrl, headers, and signal
 * @param endpoint - Relative endpoint path (e.g. '/api/events/todos')
 * @param cursor - Pagination cursor (null for first page)
 * @param limit - Page size
 */
export async function fetchEventPage(
  ctx: FetchContext,
  endpoint: string,
  cursor: string | null,
  limit: number,
): Promise<SeedEventPage> {
  const url = new URL(endpoint, ctx.baseUrl)
  if (cursor) url.searchParams.set('cursor', cursor)
  url.searchParams.set('limit', String(limit))

  const res = await fetch(url.toString(), {
    headers: { ...ctx.headers, Accept: 'application/json' },
    signal: ctx.signal,
  })
  if (!res.ok) throw new Error(`Seed fetch failed: ${res.status}`)

  const data: unknown = await res.json()
  const parsed = parseEventResponse(data)
  return {
    events: parsed.entities.map(hydrateSerializedEvent),
    nextCursor: parsed.nextCursor ?? null,
  }
}

/**
 * Fetch per-stream events for gap recovery from a hypermedia-formatted item events endpoint.
 *
 * @param ctx - Fetch context with baseUrl, headers, and signal
 * @param endpoint - Relative endpoint path with {id} already expanded (e.g. '/api/todos/abc/events')
 * @param afterRevision - Fetch events after this revision
 */
export async function fetchStreamEvents(
  ctx: FetchContext,
  endpoint: string,
  afterRevision: bigint,
): Promise<IPersistedEvent[]> {
  const url = new URL(endpoint, ctx.baseUrl)
  url.searchParams.set('afterRevision', String(afterRevision))

  const res = await fetch(url.toString(), {
    headers: { ...ctx.headers, Accept: 'application/json' },
    signal: ctx.signal,
  })
  if (!res.ok) throw new Error(`Stream fetch failed: ${res.status}`)

  const data: unknown = await res.json()
  const parsed = parseEventResponse(data)
  return parsed.entities.map(hydrateSerializedEvent)
}

/**
 * Options for {@link fetchSeedRecordPage}.
 */
export interface FetchSeedRecordPageOptions {
  /** Fetch context with baseUrl, headers, and signal. */
  ctx: FetchContext
  /** RFC 6570 URI template from `representation.collection.template`. */
  template: string
  /** Path-variable map from a `fetchTemplateVariables` callback. */
  variables: Record<string, string>
  /** Pagination cursor (null for first page). */
  cursor: string | null
  /** Page size. */
  limit: number
  /** Extra headers from a `fetchHeaders` callback, merged into `ctx.headers`. */
  headers?: Record<string, string>
  /** JSONPath into each member from which to extract `SeedRecord.revision`. */
  revisionPath?: JSONPathExpression
}

/**
 * Fetch a page of read-model records from a hypermedia collection endpoint.
 *
 * Sends `Accept: application/hal+json, application/json;q=0.9`; selects the
 * parser by the response `Content-Type`. The server is the arbiter.
 *
 * - `application/hal+json` → HAL parser: members come from `_embedded.item`;
 *   each member's `_links` is stripped; `nextCursor` is extracted from
 *   `_links.next.href`.
 * - otherwise → JSON-envelope parser: members come from `entities`;
 *   `nextCursor` comes from `body.nextCursor`.
 */
export async function fetchSeedRecordPage(
  opts: FetchSeedRecordPageOptions,
): Promise<SeedRecordPage> {
  const { ctx, template, variables, cursor, limit, headers, revisionPath } = opts

  const allVars: Record<string, string> = {
    ...variables,
    ...(cursor !== null ? { cursor } : {}),
    limit: String(limit),
  }

  const path = expandCollectionTemplate(template, allVars)
  const url = new URL(path, ctx.baseUrl)

  const res = await fetch(url.toString(), {
    headers: {
      ...ctx.headers,
      ...headers,
      Accept: 'application/hal+json, application/json;q=0.9',
    },
    signal: ctx.signal,
  })
  if (!res.ok) throw new Error(`Seed record fetch failed: ${res.status}`)

  const contentType = res.headers.get('content-type') ?? ''
  const body: unknown = await res.json()

  if (contentType.includes('application/hal+json')) {
    return parseHalCollection(body, revisionPath)
  }
  return parseJsonCollection(body, revisionPath)
}

/**
 * Expand an RFC 6570 URI template against a variables map.
 *
 * Supports the subset the toolkit's representations actually use:
 *
 * - **Simple path expansion** (`{var}`) — required, percent-encoded. Throws when
 *   the variable is missing from the map.
 * - **Form-style query expansion** (`{?var,var,...}` or continuation `{&var,...}`) —
 *   each variable is optional; missing entries are omitted; present entries are
 *   percent-encoded as `name=value` and joined with `&`. The prefix is `?` for
 *   `{?...}` and `&` for `{&...}`.
 *
 * Other RFC 6570 operators are out of scope: `{+var}`, `{#var}` (fragment),
 * `{var*}` (explode), reserved expansion, etc. — none of the toolkit's emitted
 * templates use them. `{#...}` fragment expansion is silently dropped if present.
 */
export function expandCollectionTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  let queryString = ''
  let path = template

  const queryMatch = /\{([?&])([^}]+)\}/.exec(template)
  if (queryMatch) {
    const [matched, operator, namesStr] = queryMatch
    const declaredVars = namesStr!.split(',').map((s) => s.trim())
    const pairs: string[] = []
    for (const name of declaredVars) {
      const value = variables[name]
      if (value === undefined) continue
      pairs.push(`${name}=${encodeURIComponent(value)}`)
    }
    if (pairs.length > 0) {
      queryString = (operator === '?' ? '?' : '&') + pairs.join('&')
    }
    path = template.slice(0, queryMatch.index) + template.slice(queryMatch.index + matched.length)
  }

  path = path.replace(/\{#[^}]+\}/g, '')

  path = path.replace(/\{([^}/]+)\}/g, (_, name: string) => {
    const value = variables[name]
    if (value === undefined) {
      throw new Error(`Template variable "${name}" not provided for "${template}"`)
    }
    return encodeURIComponent(value)
  })

  return path + queryString
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

interface EventResponse {
  entities: ISerializedEvent[]
  nextCursor?: string
}

function parseEventResponse(data: unknown): EventResponse {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Expected object response from event endpoint')
  }
  const obj = data as Record<string, unknown>
  if (!Array.isArray(obj['entities'])) {
    throw new Error('Expected { entities: [...] } response from event endpoint')
  }
  return {
    entities: obj['entities'] as ISerializedEvent[],
    nextCursor: typeof obj['nextCursor'] === 'string' ? obj['nextCursor'] : undefined,
  }
}

function parseHalCollection(
  body: unknown,
  revisionPath: JSONPathExpression | undefined,
): SeedRecordPage {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Expected object response from HAL collection endpoint')
  }
  const obj = body as Record<string, unknown>

  const embedded = obj['_embedded']
  const items =
    typeof embedded === 'object' && embedded !== null
      ? (embedded as Record<string, unknown>)['item']
      : undefined
  if (!Array.isArray(items)) {
    throw new Error('Expected _embedded.item array in HAL collection response')
  }

  const links = obj['_links']
  let nextCursor: string | null = null
  if (typeof links === 'object' && links !== null) {
    const next = (links as Record<string, unknown>)['next']
    if (typeof next === 'object' && next !== null) {
      const href = (next as Record<string, unknown>)['href']
      if (typeof href === 'string') {
        nextCursor = new URL(href, 'http://local').searchParams.get('cursor')
      }
    }
  }

  const records = items.map((member) => toSeedRecord(cleanHalResource(member), revisionPath))
  return { records, nextCursor }
}

function parseJsonCollection(
  body: unknown,
  revisionPath: JSONPathExpression | undefined,
): SeedRecordPage {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Expected object response from JSON collection endpoint')
  }
  const obj = body as Record<string, unknown>

  const entities = obj['entities']
  if (!Array.isArray(entities)) {
    throw new Error('Expected entities array in JSON collection response')
  }
  const nextCursor = typeof obj['nextCursor'] === 'string' ? (obj['nextCursor'] as string) : null

  const records = entities.map((entity) => toSeedRecord(entity, revisionPath))
  return { records, nextCursor }
}

/**
 * Strip HAL navigation links from a resource while preserving its embedded
 * sub-resources (recursively cleaned).
 *
 * - `_links` is dropped at every level (top-level and inside `_embedded`).
 * - `_embedded` is preserved as a nested key; each rel's resource (or array
 *   of resources) is recursively cleaned by the same rules.
 * - Domain properties (any key other than `_links` / `_embedded`) pass through
 *   verbatim — no recursion. A nested object that happens to live under a
 *   domain key is treated as opaque data, not as a HAL resource.
 *
 * The recursive strip on `_links` is intentional even though consumers may
 * eventually want them for app-side concerns; see the open exploration in
 * `docs/projects/hypermedia-client/explorations/hal-link-stripping.md` for
 * the configurability question.
 */
function cleanHalResource(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  if (Array.isArray(value)) return value.map(cleanHalResource)

  const obj = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_links') continue
    if (k === '_embedded') {
      if (typeof v !== 'object' || v === null) continue
      const embedded = v as Record<string, unknown>
      const cleaned: Record<string, unknown> = {}
      for (const [rel, res] of Object.entries(embedded)) {
        cleaned[rel] = cleanHalResource(res)
      }
      result['_embedded'] = cleaned
      continue
    }
    result[k] = v
  }
  return result
}

function toSeedRecord(data: unknown, revisionPath: JSONPathExpression | undefined): SeedRecord {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Expected member to be an object')
  }
  const obj = data as Record<string, unknown>
  const id = obj['id']
  if (typeof id !== 'string') {
    throw new Error('Expected member.id to be a string')
  }

  const record: SeedRecord = { id, data: obj }
  if (revisionPath !== undefined) {
    const value = readJsonPath(obj, revisionPath)
    if (typeof value === 'string') record.revision = value
  }
  return record
}

/**
 * Read a value at a JSONPath expression.
 *
 * Scoped subset of {@link JSONPathExpression}: `$`-rooted, dot members
 * (`.foo`) and bracket-string members (`['foo']`) only. Wildcard `[*]`,
 * index selectors, recursive descent, etc. throw — they are not in scope
 * for `Collection.revisionPath` per its docstring (which cites `'$.revision'`
 * and `'$.latestRevision'` as canonical examples).
 */
function readJsonPath(obj: unknown, path: JSONPathExpression): unknown {
  if (!path.startsWith('$')) {
    throw new Error(`JSONPath must start with $: "${path}"`)
  }
  let cur: unknown = obj
  let rest = path.slice(1)
  while (rest.length > 0) {
    const dotMatch = /^\.([A-Za-z_$][A-Za-z0-9_$]*)/.exec(rest)
    if (dotMatch) {
      if (typeof cur !== 'object' || cur === null) return undefined
      cur = (cur as Record<string, unknown>)[dotMatch[1]!]
      rest = rest.slice(dotMatch[0].length)
      continue
    }
    const bracketMatch = /^\['([^']+)'\]/.exec(rest)
    if (bracketMatch) {
      if (typeof cur !== 'object' || cur === null) return undefined
      cur = (cur as Record<string, unknown>)[bracketMatch[1]!]
      rest = rest.slice(bracketMatch[0].length)
      continue
    }
    throw new Error(
      `Unsupported JSONPath segment "${rest}" in "${path}" — only dot- and bracket-string members supported`,
    )
  }
  return cur
}
