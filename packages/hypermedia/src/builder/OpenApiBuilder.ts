import type { JSONSchema7 } from 'json-schema'
import { HydraDoc } from '../HydraDoc.js'
import type { BuildResult } from './HydraBuilder.js'
import { stableOrder } from './HydraBuilder.js'

// ---------------------------------------------------------------------------
// OpenAPI 3.1 types (subset we actually emit)
// ---------------------------------------------------------------------------

interface OpenApiDocument {
  openapi: '3.1.0'
  info: OpenApiInfo
  paths: Record<string, OpenApiPathItem>
  tags: OpenApiTag[]
}

interface OpenApiInfo {
  title: string
  version: string
}

interface OpenApiTag {
  name: string
  description?: string
}

interface OpenApiPathItem {
  get?: OpenApiOperation
  post?: OpenApiOperation
}

interface OpenApiOperation {
  operationId?: string
  tags: string[]
  description?: string
  deprecated?: true
  parameters?: OpenApiParameter[]
  requestBody?: OpenApiRequestBody
  responses: Record<string, OpenApiResponse>
}

interface OpenApiParameter {
  name: string
  in: 'path' | 'query'
  required?: boolean
  schema?: JSONSchema7
  description?: string
}

interface OpenApiRequestBody {
  required: boolean
  content: Record<string, { schema: OpenApiSchemaRef }>
}

interface OpenApiResponse {
  description: string
  content?: Record<string, { schema: OpenApiSchemaRef }>
}

interface OpenApiSchemaRef {
  $ref: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface HydraPropertyDocumentation {
  schema?: JSONSchema7
  description?: string
}

export interface OpenApiDocumentation {
  info: OpenApiInfo
  /** Classes to generate OpenAPI paths from */
  classes: HydraDoc.ClassDef[]
  /**
   * Default schemas for hydra properties, keyed by property name (e.g. 'nb:todoId', 'svc:cursor').
   * Used as the default parameter schema when a mapping does not provide a per-mapping override.
   */
  hydraPropertyDictionary?: Record<string, HydraPropertyDocumentation>
  /** Responses always present on every operation (e.g., 5xx codes). Cannot be opted out. */
  globalResponses?: HydraDoc.ResolvedResponseDef[]
  /** Schema registry for response inheritance. Last fallback when resolving schemas by (code, contentType). */
  responses?: HydraDoc.ResolvedResponseDef[]
}

export interface OpenApiBuildOptions extends OpenApiDocumentation {
  /** Hydra build result — provides all processed schemas */
  hydraBuild: BuildResult
}

export interface OpenApiBuildResult {
  /** The OpenAPI 3.1 document object */
  document: OpenApiDocument
  /** Pretty-printed, key-sorted JSON string (stable for commits) */
  content: string
  /** Non-fatal warnings */
  warnings: string[]
}

/**
 * Built-in property documentation for well-known svc: properties.
 * Spread into your hydraPropertyDictionary to cover standard pagination/query parameters.
 *
 * ```ts
 * hydraPropertyDictionary: {
 *   ...builtinPropertyDictionary,
 *   'nb:todoId': { schema: { type: 'string' }, description: 'Unique todo identifier' },
 *   // ...
 * }
 * ```
 */
export const builtinPropertyDictionary = {
  'svc:cursor': {
    schema: { type: 'string' },
    description: 'Opaque pagination cursor returned by a previous response',
  },
  'svc:limit': {
    schema: { type: 'integer', minimum: 1 },
    description: 'Maximum number of items to return',
  },
  'svc:afterPosition': {
    schema: { type: 'string' },
    description: 'Return events after this position',
  },
} satisfies Record<string, HydraPropertyDocumentation>

export function buildOpenApiDocument(opts: OpenApiBuildOptions): OpenApiBuildResult {
  const { classes, hydraBuild } = opts
  const warnings: string[] = []

  const tags: OpenApiTag[] = []
  const paths: Record<string, OpenApiPathItem> = {}

  const globalResponses = opts.globalResponses ?? []
  const responseRegistry = opts.responses ?? []

  const ctx: BuildContext = {
    hydraPropertyDictionary: opts.hydraPropertyDictionary ?? {},
    missingProperties: new Set<string>(),
    globalResponses,
    responseRegistry,
    warnings,
  }

  for (const cls of classes) {
    const tagName = classTag(cls.class)
    tags.push({ name: tagName, ...(cls.description ? { description: cls.description } : {}) })

    // ---- query surfaces (GET) ----
    for (const rep of cls.representations) {
      addQuerySurface({ ...ctx, paths, surface: rep.resource, tag: tagName, role: 'resource', rep })
      addQuerySurface({
        ...ctx,
        paths,
        surface: rep.collection,
        tag: tagName,
        role: 'collection',
        rep,
      })

      if (isRepresentation(rep)) {
        if (rep.itemEvents) {
          addQuerySurface({
            ...ctx,
            paths,
            surface: rep.itemEvents,
            tag: tagName,
            role: 'itemEvents',
            rep,
          })
        }
        if (rep.aggregateEvents) {
          addQuerySurface({
            ...ctx,
            paths,
            surface: rep.aggregateEvents,
            tag: tagName,
            role: 'aggregateEvents',
            rep,
          })
        }
      }
    }

    // ---- command surfaces (POST) ----
    if (cls.commands) {
      addCommandOperations({ ...ctx, paths, commands: cls.commands, tag: tagName })
    }
  }

  if (ctx.missingProperties.size > 0) {
    const entries = [...ctx.missingProperties]
      .sort()
      .map((p) => `  '${p}': {},`)
      .join('\n')
    warnings.push(
      `Missing hydraPropertyDictionary entries for IriTemplate mappings. Add these to your hydraPropertyDictionary:\n${entries}`,
    )
  }

  const document: OpenApiDocument = {
    openapi: '3.1.0',
    info: opts.info,
    paths,
    tags,
  }

  const content = JSON.stringify(stableOrder(document), null, 2) + '\n'
  return { document, content, warnings }
}

// ---------------------------------------------------------------------------
// Query surface → GET operation
// ---------------------------------------------------------------------------

type SurfaceRole = 'resource' | 'collection' | 'itemEvents' | 'aggregateEvents'

interface BuildContext {
  hydraPropertyDictionary: Record<string, HydraPropertyDocumentation>
  missingProperties: Set<string>
  globalResponses: HydraDoc.ResolvedResponseDef[]
  responseRegistry: HydraDoc.ResolvedResponseDef[]
  warnings: string[]
}

interface AddQuerySurfaceOpts extends BuildContext {
  paths: Record<string, OpenApiPathItem>
  surface: HydraDoc.QuerySurface
  tag: string
  role: SurfaceRole
  rep: HydraDoc.Representation<HydraDoc.EventsConfig | undefined> | HydraDoc.ViewRepresentation
}

function addQuerySurface(opts: AddQuerySurfaceOpts): void {
  const { paths, surface, tag, role, rep } = opts
  const pathKey = toOpenApiPath(surface.template.template)
  const item = (paths[pathKey] ??= {})

  // If a GET already exists on this path, skip (e.g., resource and collection share a base path).
  if (item.get) return

  if (!surface.operationId) {
    opts.warnings.push(`Missing operationId on ${role} surface ${surface.template.id}`)
  }
  const parameters = buildParameters(surface.template, opts)
  const responses = resolveResponses(surface.responses, undefined, opts)

  // OpenAPI requires at least one response
  if (Object.keys(responses).length === 0) {
    responses['200'] = { description: 'Success' }
  }

  item.get = {
    ...(surface.operationId ? { operationId: surface.operationId } : {}),
    tags: [tag],
    ...(surface.description ? { description: surface.description } : {}),
    ...(rep.deprecated ? { deprecated: true as const } : {}),
    ...(parameters.length > 0 ? { parameters } : {}),
    responses,
  }
}

// ---------------------------------------------------------------------------
// Command surfaces → POST operations
// ---------------------------------------------------------------------------

interface AddCommandOperationsOpts extends BuildContext {
  paths: Record<string, OpenApiPathItem>
  commands: HydraDoc.CommandsDef<string>
  tag: string
}

function addCommandOperations(opts: AddCommandOperationsOpts): void {
  const { paths, commands, tag } = opts

  // Group commands by their effective surface path
  const bySurface = new Map<
    string,
    {
      surface: HydraDoc.CommandSurface<string> | HydraDoc.CustomCommandSurface
      commands: HydraDoc.CommandCapability<string>[]
    }
  >()

  for (const cap of commands.commands) {
    const surface = cap.surface ?? commands.mustSurface(cap.dispatch!)
    const pathKey = toOpenApiPath(surface.hrefBase)

    let group = bySurface.get(pathKey)
    if (!group) {
      group = { surface, commands: [] }
      bySurface.set(pathKey, group)
    }
    group.commands.push(cap)
  }

  for (const [pathKey, group] of bySurface) {
    const item = (paths[pathKey] ??= {})
    const parameters = buildParameters(group.surface.template, opts)

    // Collect all request schemas for this surface's commands
    const requestSchemas: OpenApiSchemaRef[] = []
    for (const cap of group.commands) {
      if (cap.schema?.$id) {
        requestSchemas.push({ $ref: cap.schema.$id })
      }
    }

    // Build request body — oneOf when multiple commands share a surface
    let requestBody: OpenApiRequestBody | undefined
    if (requestSchemas.length === 1) {
      const ref = requestSchemas[0]!
      requestBody = {
        required: true,
        content: { 'application/json': { schema: ref } },
      }
    } else if (requestSchemas.length > 1) {
      requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { oneOf: requestSchemas } as unknown as OpenApiSchemaRef,
          },
        },
      }
    }

    // Resolve responses — surface defaults, then per-command overrides merged
    const surfaceResponses = 'responses' in group.surface ? group.surface.responses : undefined
    const responses = mergeCommandResponses(group.commands, surfaceResponses, opts)

    const surfaceOperationId =
      'operationId' in group.surface ? group.surface.operationId : undefined
    if (!surfaceOperationId) {
      opts.warnings.push(`Missing operationId on command surface ${group.surface.template.id}`)
    }
    const anyDeprecated = group.commands.length > 0 && group.commands.every((c) => c.deprecated)
    const description = 'description' in group.surface ? group.surface.description : undefined

    // OpenAPI requires at least one response
    if (Object.keys(responses).length === 0) {
      responses['200'] = { description: 'Success' }
    }

    item.post = {
      ...(surfaceOperationId ? { operationId: surfaceOperationId } : {}),
      tags: [tag],
      ...(description ? { description } : {}),
      ...(anyDeprecated ? { deprecated: true as const } : {}),
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(requestBody ? { requestBody } : {}),
      responses,
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert RFC6570 template to OpenAPI path (strip query expansion). */
function toOpenApiPath(template: string): string {
  return template.replace(/\{\?[^}]*\}$/, '')
}

/** Derive tag name from class IRI: "nb:Todo" → "Todo" */
function classTag(classIri: string): string {
  const colonIdx = classIri.indexOf(':')
  return colonIdx >= 0 ? classIri.slice(colonIdx + 1) : classIri
}

/** Build OpenAPI parameters from an IriTemplate. */
function buildParameters(template: HydraDoc.IriTemplate, ctx: BuildContext): OpenApiParameter[] {
  const { hydraPropertyDictionary, missingProperties } = ctx
  const pathVarPattern = /\{(\w+)\}/g
  const pathVars = new Set<string>()
  const pathPart = template.template.replace(/\{\?[^}]*\}$/, '')
  let match: RegExpExecArray | null = null
  while ((match = pathVarPattern.exec(pathPart)) !== null) {
    pathVars.add(match[1]!)
  }

  return template.mappings.map((m) => {
    const inPath = pathVars.has(m.variable)
    const dictEntry = hydraPropertyDictionary[m.property]
    const schema = m.schema ?? dictEntry?.schema
    const description = m.description ?? dictEntry?.description
    if (!schema) {
      missingProperties.add(m.property)
    }
    return {
      name: m.variable,
      in: inPath ? ('path' as const) : ('query' as const),
      ...(inPath || m.required ? { required: true } : {}),
      ...(schema ? { schema } : {}),
      ...(description ? { description } : {}),
    }
  })
}

// ---------------------------------------------------------------------------
// Response resolution
// ---------------------------------------------------------------------------

const DEFAULT_CONTENT_TYPE = 'application/json'

/** Standard HTTP status descriptions used when no explicit description is provided. */
function httpStatusDescription(code: number): string {
  return HTTP_STATUS_DESCRIPTIONS[code] ?? 'Response'
}

const HTTP_STATUS_DESCRIPTIONS: Record<number, string> = {
  200: 'Success',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
}

/** Normalize a ResponseEntry to its (code, contentType) pair with optional schema/description. */
interface NormalizedResponseDef extends HydraDoc.ResponseDef {
  contentType: string
}

function normalizeEntry(entry: HydraDoc.ResponseEntry): NormalizedResponseDef {
  if (typeof entry === 'number') {
    return { code: entry, contentType: DEFAULT_CONTENT_TYPE }
  }
  return { ...entry, contentType: entry.contentType ?? DEFAULT_CONTENT_TYPE }
}

type PairKey = string // "code:contentType"

function pairKey(code: number, contentType: string): PairKey {
  return `${code}:${contentType}`
}

/** Look up schema for a (code, contentType) pair in a list of resolved defs. */
function findInRegistry(
  code: number,
  contentType: string,
  registry: readonly HydraDoc.ResolvedResponseDef[],
): HydraDoc.ResolvedResponseDef | undefined {
  return registry.find((r) => r.code === code && r.contentType === contentType)
}

/**
 * Resolve responses for a GET operation (query surface).
 * Active pairs: surface.responses if provided, else none (only globals).
 */
function resolveResponses(
  operationResponses: readonly HydraDoc.ResponseEntry[] | undefined,
  surfaceResponses: readonly HydraDoc.ResponseEntry[] | undefined,
  ctx: BuildContext,
): Record<string, OpenApiResponse> {
  const { globalResponses, responseRegistry, warnings } = ctx

  // Collect resolved pairs keyed by (code, contentType)
  const pairs = new Map<
    PairKey,
    { code: number; contentType: string; schema?: JSONSchema7; description?: string }
  >()

  // 1. Start with global responses — always present
  for (const g of globalResponses) {
    const key = pairKey(g.code, g.contentType)
    pairs.set(key, {
      code: g.code,
      contentType: g.contentType,
      schema: g.schema,
      description: g.description,
    })
  }

  // 2. Determine opted-in entries
  const activeEntries = operationResponses ?? surfaceResponses
  if (activeEntries) {
    for (const entry of activeEntries) {
      const norm = normalizeEntry(entry)
      const key = pairKey(norm.code, norm.contentType)

      // Resolve schema: explicit > surface > registry > global (already in pairs)
      let schema = norm.schema
      let description = norm.description
      if (schema === HydraDoc.NO_BODY) {
        pairs.set(key, { code: norm.code, contentType: norm.contentType, description })
        continue
      }

      if (!schema && surfaceResponses) {
        const surfDef = surfaceResponses
          .map(normalizeEntry)
          .find((s) => s.code === norm.code && s.contentType === norm.contentType)
        if (surfDef?.schema && surfDef.schema !== HydraDoc.NO_BODY) {
          schema = surfDef.schema
        }
        if (!description && surfDef?.description) {
          description = surfDef.description
        }
      }

      if (!schema) {
        const regDef = findInRegistry(norm.code, norm.contentType, responseRegistry)
        if (regDef) {
          schema = regDef.schema
          if (!description) description = regDef.description
        }
      }

      if (!schema) {
        const globalDef = findInRegistry(norm.code, norm.contentType, globalResponses)
        if (globalDef) {
          schema = globalDef.schema
          if (!description) description = globalDef.description
        }
      }

      if (!schema) {
        warnings.push(
          `No schema found for response (${norm.code}, ${norm.contentType}). Define it in responses or globalResponses.`,
        )
      }

      pairs.set(key, { code: norm.code, contentType: norm.contentType, schema, description })
    }
  }

  return buildOpenApiResponses(pairs)
}

/**
 * Resolve and merge responses across multiple commands sharing a POST endpoint.
 */
function mergeCommandResponses(
  commands: HydraDoc.CommandCapability<string>[],
  surfaceResponses: readonly HydraDoc.ResponseEntry[] | undefined,
  ctx: BuildContext,
): Record<string, OpenApiResponse> {
  if (commands.length === 1) {
    return resolveResponses(commands[0]?.responses, surfaceResponses, ctx)
  }

  // Resolve each command independently, then merge per (code, contentType)
  const perCommand: Map<
    PairKey,
    { code: number; contentType: string; schemaId?: string; description?: string }
  >[] = []
  for (const cap of commands) {
    const resolved = resolveResponses(cap.responses, surfaceResponses, ctx)
    const cmdPairs = new Map<
      PairKey,
      { code: number; contentType: string; schemaId?: string; description?: string }
    >()
    for (const [codeStr, resp] of Object.entries(resolved)) {
      const code = parseInt(codeStr, 10)
      if (resp.content) {
        for (const [ct, entry] of Object.entries(resp.content)) {
          const key = pairKey(code, ct)
          cmdPairs.set(key, {
            code,
            contentType: ct,
            schemaId: entry.schema.$ref,
            description: resp.description,
          })
        }
      } else {
        const key = pairKey(code, DEFAULT_CONTENT_TYPE)
        cmdPairs.set(key, {
          code,
          contentType: DEFAULT_CONTENT_TYPE,
          description: resp.description,
        })
      }
    }
    perCommand.push(cmdPairs)
  }

  // Merge: union all pairs, dedup or oneOf per pair
  const merged = new Map<
    PairKey,
    { code: number; contentType: string; schemaIds: Set<string>; description?: string }
  >()
  for (const cmdPairs of perCommand) {
    for (const [key, val] of cmdPairs) {
      let existing = merged.get(key)
      if (!existing) {
        existing = {
          code: val.code,
          contentType: val.contentType,
          schemaIds: new Set(),
          description: val.description,
        }
        merged.set(key, existing)
      }
      if (val.schemaId) {
        existing.schemaIds.add(val.schemaId)
      }
      if (!existing.description && val.description) {
        existing.description = val.description
      }
    }
  }

  // Build final OpenAPI responses
  const result: Record<string, OpenApiResponse> = {}
  for (const [, val] of merged) {
    const codeStr = String(val.code)
    const existing = result[codeStr]
    const description = val.description ?? httpStatusDescription(val.code)

    const ids = [...val.schemaIds]
    if (ids.length === 0) {
      if (!existing) {
        result[codeStr] = { description }
      }
      continue
    }

    const schema: OpenApiSchemaRef =
      ids.length === 1
        ? { $ref: ids[0]! }
        : ({ oneOf: ids.map((id) => ({ $ref: id })) } as unknown as OpenApiSchemaRef)

    const content = existing?.content ?? {}
    content[val.contentType] = { schema }
    result[codeStr] = { description, content }
  }

  return result
}

/** Convert resolved pairs into OpenAPI response objects grouped by status code. */
function buildOpenApiResponses(
  pairs: Map<
    PairKey,
    { code: number; contentType: string; schema?: JSONSchema7; description?: string }
  >,
): Record<string, OpenApiResponse> {
  const result: Record<string, OpenApiResponse> = {}
  for (const [, val] of pairs) {
    const codeStr = String(val.code)
    const description = val.description ?? httpStatusDescription(val.code)

    if (!val.schema) {
      if (!result[codeStr]) {
        result[codeStr] = { description }
      }
      continue
    }

    const existing = result[codeStr]
    const content = existing?.content ?? {}
    if (val.schema.$id) {
      content[val.contentType] = { schema: { $ref: val.schema.$id } }
    }
    result[codeStr] = { description, content }
  }
  return result
}

function isRepresentation(
  rep: HydraDoc.Representation<HydraDoc.EventsConfig | undefined> | HydraDoc.ViewRepresentation,
): rep is HydraDoc.Representation<HydraDoc.EventsConfig | undefined> {
  return 'itemEvents' in rep || 'aggregateEvents' in rep
}
