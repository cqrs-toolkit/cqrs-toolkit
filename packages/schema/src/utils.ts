import type { ErrorObject } from 'ajv'
import type { JSONSchema7 } from 'json-schema'
import type { HydrationEnvelope, HydrationPlan, SchemaVisitor } from './types.js'
import { FieldError } from './types.js'

export const EMPTY_STAR_MAP: ReadonlyMap<string, readonly string[]> = new Map()
export const EMPTY_ENVELOPE: HydrationEnvelope = { paths: [], starMap: EMPTY_STAR_MAP }
export const EMPTY_PLAN: HydrationPlan = new Map()

// --- Build-time accumulator per visitor ---

export interface WalkContext {
  readonly paths: string[]
  readonly starEntries: [string, readonly string[]][]
}

export function getOrCreateContext(ctx: Map<string, WalkContext>, name: string): WalkContext {
  let entry = ctx.get(name)
  if (!entry) {
    entry = { paths: [], starEntries: [] }
    ctx.set(name, entry)
  }
  return entry
}

export function buildPlanFromContext(ctx: Map<string, WalkContext>): HydrationPlan {
  if (ctx.size === 0) return EMPTY_PLAN
  const plan = new Map<string, HydrationEnvelope>()
  for (const [name, wctx] of ctx) {
    if (wctx.paths.length === 0 && wctx.starEntries.length === 0) continue
    plan.set(name, {
      paths: wctx.paths,
      starMap: wctx.starEntries.length > 0 ? new Map(wctx.starEntries) : EMPTY_STAR_MAP,
    })
  }
  return plan
}

// --- Transparent walker (no $id/$ref handling) ---

/**
 * Walk a JSON Schema to find all leaf paths matching any visitor.
 * Paths use dot notation for properties, `[]` for array items, `[N]` for tuple indices,
 * and `*` for additionalProperties.
 *
 * This is a pure recursive walk with no `$id`/`$ref` side effects — suitable for
 * one-off schema analysis (e.g., `parseOnce`).
 */
export function buildHydrationPlan(
  schema: JSONSchema7,
  visitors: readonly SchemaVisitor[],
): HydrationPlan {
  const ctx = new Map<string, WalkContext>()
  walkTransparent(schema, '', visitors, ctx)
  return buildPlanFromContext(ctx)
}

function walkTransparent(
  schema: JSONSchema7,
  path: string,
  visitors: readonly SchemaVisitor[],
  ctx: Map<string, WalkContext>,
): void {
  // Leaf detection — iterate all visitors
  for (const visitor of visitors) {
    if (visitor.match(schema)) {
      getOrCreateContext(ctx, visitor.name).paths.push(path)
    }
  }

  // properties
  if (schema.properties) {
    for (const [key, child] of Object.entries(schema.properties)) {
      if (typeof child === 'boolean') continue
      walkTransparent(child, `${path}.${key}`, visitors, ctx)
    }
  }

  // items
  if (schema.items && typeof schema.items !== 'boolean') {
    if (Array.isArray(schema.items)) {
      for (const [i, rawItem] of schema.items.entries()) {
        if (typeof rawItem === 'boolean') continue
        walkTransparent(rawItem, `${path}[${i}]`, visitors, ctx)
      }
    } else {
      walkTransparent(schema.items, `${path}[]`, visitors, ctx)
    }
  }

  // oneOf / anyOf / allOf
  for (const keyword of ['oneOf', 'anyOf', 'allOf'] as const) {
    const branches = schema[keyword]
    if (!Array.isArray(branches)) continue
    for (const branch of branches) {
      if (typeof branch === 'boolean') continue
      walkTransparent(branch, path, visitors, ctx)
    }
  }

  // additionalProperties
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    const subCtx = new Map<string, WalkContext>()
    walkTransparent(schema.additionalProperties, '', visitors, subCtx)
    const subPlan = buildPlanFromContext(subCtx)
    composeAdditionalPropertiesFromPlan(schema, subPlan, path, ctx)
  }
}

// --- Shared additionalProperties composition ---

/**
 * Compose hydration paths from an already-resolved additionalProperties sub-plan.
 * Adds a `*` prefix to sub-plan paths and records a starMap entry with all
 * static property keys so the hydrator skips them.
 */
export function composeAdditionalPropertiesFromPlan(
  parentSchema: JSONSchema7,
  subPlan: HydrationPlan,
  path: string,
  ctx: Map<string, WalkContext>,
): void {
  if (subPlan.size === 0) return

  const staticKeys = getStaticPropertyKeys(parentSchema)

  for (const [name, envelope] of subPlan) {
    if (envelope.paths.length === 0 && envelope.starMap.size === 0) continue

    const wctx = getOrCreateContext(ctx, name)

    // Add starMap entry with static property keys to skip
    if (staticKeys.length > 0) {
      wctx.starEntries.push([`${path}.*`, staticKeys])
    }

    // Compose sub-schema's paths with * prefix
    for (const p of envelope.paths) {
      wctx.paths.push(`${path}.*${p}`)
    }
    // Compose sub-schema's starMap with * prefix
    for (const [prefix, keys] of envelope.starMap) {
      wctx.starEntries.push([`${path}.*${prefix}`, keys])
    }
  }
}

function getStaticPropertyKeys(parentSchema: JSONSchema7): readonly string[] {
  if (!parentSchema.properties) return []
  return Object.keys(parentSchema.properties)
}

// --- Runtime hydration ---

/**
 * After AJV validation, convert string values at matched paths using the provided hydrate function.
 * Non-matching strings (e.g., `'latest'` in a union) are left unchanged when hydrate returns undefined.
 */
export function applyHydration(
  data: unknown,
  envelope: HydrationEnvelope,
  hydrate: (value: string, parent: Record<string, unknown> | undefined) => unknown,
): void {
  for (const path of envelope.paths) {
    applyHydrationAtPath(data, path.split('.').filter(Boolean), '', envelope, hydrate)
  }
}

function applyHydrationAtPath(
  current: any,
  parts: string[],
  canonicalPrefix: string,
  envelope: HydrationEnvelope,
  hydrate: (value: string, parent: Record<string, unknown> | undefined) => unknown,
): void {
  if (current == null || !hasParts(parts)) return

  const [head, ...rest] = parts

  if (head === '*') {
    const starPath = `${canonicalPrefix}.*`
    const excludeKeys = envelope.starMap.get(starPath)
    const excludeSet = excludeKeys ? new Set(excludeKeys) : undefined
    for (const key of Object.keys(current)) {
      if (excludeSet?.has(key)) continue
      if (rest.length === 0) {
        if (typeof current[key] === 'string') {
          const converted = hydrate(current[key], current)
          if (converted !== undefined) current[key] = converted
        }
      } else {
        applyHydrationAtPath(current[key], rest, starPath, envelope, hydrate)
      }
    }
    return
  }

  const arrayAllMatch = head.match(/^(.+)\[\]$/)
  const arrayIdxMatch = head.match(/^(.+)\[(\d+)\]$/)

  if (arrayAllMatch) {
    const key = arrayAllMatch[1]!
    const nextPrefix = `${canonicalPrefix}.${head}`
    if (!Array.isArray(current[key])) return
    if (rest.length === 0) {
      for (let i = 0; i < current[key].length; i++) {
        if (typeof current[key][i] === 'string') {
          const converted = hydrate(current[key][i], undefined)
          if (converted !== undefined) current[key][i] = converted
        }
      }
    } else {
      for (const item of current[key]) {
        applyHydrationAtPath(item, rest, nextPrefix, envelope, hydrate)
      }
    }
  } else if (arrayIdxMatch) {
    const key = arrayIdxMatch[1]!
    const idx = Number(arrayIdxMatch[2])
    const nextPrefix = `${canonicalPrefix}.${head}`
    if (!Array.isArray(current[key])) return
    if (rest.length === 0) {
      if (typeof current[key][idx] === 'string') {
        const converted = hydrate(current[key][idx], undefined)
        if (converted !== undefined) current[key][idx] = converted
      }
    } else {
      applyHydrationAtPath(current[key][idx], rest, nextPrefix, envelope, hydrate)
    }
  } else {
    const nextPrefix = `${canonicalPrefix}.${head}`
    if (rest.length === 0) {
      if (typeof current[head] === 'string') {
        const converted = hydrate(current[head], current)
        if (converted !== undefined) current[head] = converted
      }
    } else {
      applyHydrationAtPath(current[head], rest, nextPrefix, envelope, hydrate)
    }
  }
}

// --- AJV error transformation ---

export function transformAjvErrors(errors: ErrorObject[]): FieldError[] {
  const result: FieldError[] = []

  for (const error of errors) {
    let path: string
    if (error.keyword === 'required') {
      const missingProperty = (error.params as { missingProperty: string }).missingProperty
      const base = instancePathToDot(error.instancePath)
      path = base ? `${base}.${missingProperty}` : missingProperty
    } else {
      path = instancePathToDot(error.instancePath)
    }

    result.push({
      path,
      code: error.keyword,
      message: error.message ?? 'Unknown validation error',
      params: error.params as Record<string, unknown>,
    })
  }

  return result
}

// --- Internal helpers ---

function hasParts(parts: string[]): parts is [string, ...string[]] {
  return parts.length > 0
}

function instancePathToDot(instancePath: string): string {
  if (!instancePath) return ''
  // instancePath is like "/foo/bar/0/baz" — strip leading slash, replace remaining with dots
  return instancePath.slice(1).replaceAll('/', '.')
}
