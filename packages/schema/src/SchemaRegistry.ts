import type { Ajv, ValidateFunction } from 'ajv'
import type { JSONSchema7 } from 'json-schema'
import assert from 'node:assert'

export interface Int64Envelope {
  /** All int64 paths, including ones containing `*` segments. */
  readonly paths: readonly string[]
  /**
   * Maps each `*` path prefix to property keys the hydrator must skip.
   * When the hydrator encounters a `*` segment in a path, it looks up the `*` prefix
   * here to know which object keys are statically defined properties (not dynamic keys).
   */
  readonly starMap: ReadonlyMap<string, readonly string[]>
}

interface WalkContext {
  readonly paths: string[]
  readonly starEntries: [string, readonly string[]][]
}

export const EMPTY_STAR_MAP: ReadonlyMap<string, readonly string[]> = new Map()
export const EMPTY_ENVELOPE: Int64Envelope = { paths: [], starMap: EMPTY_STAR_MAP }

/**
 * Walks JSON Schema trees, discovers reusable sub-schemas (those with `$id`), registers them
 * with AJV, replaces inline definitions with `$ref` pointers, and computes int64 path envelopes
 * for runtime BigInt hydration.
 *
 * **Common schemas** are sub-schemas auto-discovered via `$id` during tree walks.
 * `getCommonSchemas()` returns them for documentation generation and client discovery.
 * Schemas passed directly to `register()` are excluded from common schemas because direct
 * `register()` calls are for validation, not discovery — the caller already knows about them.
 */
export class SchemaRegistry {
  private addedRefs = new Set<JSONSchema7>()
  private commonSchemas = new Map<string, JSONSchema7>()
  private manuallyRegistered = new Set<JSONSchema7>()
  private int64PathCache = new Map<JSONSchema7, Int64Envelope>()
  private idToSchema = new Map<string, JSONSchema7>()

  constructor(private ajv: Ajv) {}

  /**
   * Walk schema tree, discover $id sub-schemas, replace with $ref, cache int64 paths.
   *
   * Schemas referenced via pre-existing `$ref` (not `$id`) must be registered
   * before the schemas that reference them.
   */
  public register(schema: JSONSchema7): void {
    this.manuallyRegistered.add(schema)
    if (schema.$id && !this.addedRefs.has(schema)) {
      this.processSchema(schema)
      this.ajv.addSchema(schema)
      this.addedRefs.add(schema)
      this.idToSchema.set(schema.$id, schema)
    } else {
      this.processSchema(schema)
    }
  }

  /** register() + ajv.compile(). Returns the compiled validator. */
  public compile(schema: JSONSchema7): ValidateFunction {
    this.register(schema)
    return this.ajv.compile(schema)
  }

  /** Auto-discovered schemas (found via $id during tree walks). */
  public getCommonSchemas(): ReadonlyMap<string, JSONSchema7> {
    return this.commonSchemas
  }

  /** Cached int64 path envelope for a registered schema. */
  public getInt64Paths(schema: JSONSchema7): Int64Envelope {
    return this.int64PathCache.get(schema) ?? EMPTY_ENVELOPE
  }

  private processSchema(schema: JSONSchema7): void {
    if (this.int64PathCache.has(schema)) return
    const ctx: WalkContext = { paths: [], starEntries: [] }
    this.walkSchema(schema, '', ctx)
    this.int64PathCache.set(schema, {
      paths: ctx.paths,
      starMap: ctx.starEntries.length > 0 ? new Map(ctx.starEntries) : EMPTY_STAR_MAP,
    })
  }

  private walkSchema(schema: JSONSchema7, path: string, ctx: WalkContext): void {
    // Int64 leaf detection
    if (schema.type === 'string' && schema.format === 'int64') {
      ctx.paths.push(path)
    }

    // properties
    if (schema.properties) {
      for (const [key, child] of Object.entries(schema.properties)) {
        if (typeof child === 'boolean') continue
        const childPath = `${path}.${key}`
        if (child.$id) {
          this.ensureCommonRegistered(child)
          this.composeInt64Paths(child, childPath, ctx)
          schema.properties[key] = { $ref: child.$id }
        } else {
          this.walkSchema(child, childPath, ctx)
        }
      }
    }

    // items (single schema)
    if (schema.items && typeof schema.items !== 'boolean') {
      if (Array.isArray(schema.items)) {
        // tuple
        for (const [i, rawItem] of schema.items.entries()) {
          if (typeof rawItem === 'boolean') continue
          const item: JSONSchema7 = rawItem
          const itemPath = `${path}[${i}]`
          if (item.$id) {
            this.ensureCommonRegistered(item)
            this.composeInt64Paths(item, itemPath, ctx)
            schema.items[i] = { $ref: item.$id }
          } else {
            this.walkSchema(item, itemPath, ctx)
          }
        }
      } else {
        const itemPath = `${path}[]`
        if (schema.items.$id) {
          this.ensureCommonRegistered(schema.items)
          this.composeInt64Paths(schema.items, itemPath, ctx)
          schema.items = { $ref: schema.items.$id }
        } else {
          this.walkSchema(schema.items, itemPath, ctx)
        }
      }
    }

    // oneOf / anyOf / allOf
    for (const keyword of ['oneOf', 'anyOf', 'allOf'] as const) {
      const branches = schema[keyword]
      if (!Array.isArray(branches)) continue
      for (const [i, rawBranch] of branches.entries()) {
        if (typeof rawBranch === 'boolean') continue
        const branch: JSONSchema7 = rawBranch
        if (branch.$id) {
          this.ensureCommonRegistered(branch)
          this.composeInt64Paths(branch, path, ctx)
          branches[i] = { $ref: branch.$id }
        } else {
          this.walkSchema(branch, path, ctx)
        }
      }
    }

    // additionalProperties
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      const addProps = schema.additionalProperties
      if (addProps.$id) {
        this.ensureCommonRegistered(addProps)
        this.collectAdditionalPropertiesInt64(schema, addProps, path, ctx)
        schema.additionalProperties = { $ref: addProps.$id }
      } else if (addProps.$ref) {
        const target = this.idToSchema.get(addProps.$ref)
        assert(target, `SchemaRegistry: $ref "${addProps.$ref}" references an unregistered schema`)
        this.collectAdditionalPropertiesInt64(schema, target, path, ctx)
      } else {
        this.processSchema(addProps)
        this.collectAdditionalPropertiesInt64(schema, addProps, path, ctx)
      }
    }

    // Existing $ref (pre-existing, not placed by this processor)
    if (schema.$ref) {
      const target = this.idToSchema.get(schema.$ref)
      assert(target, `SchemaRegistry: $ref "${schema.$ref}" references an unregistered schema`)
      this.composeInt64Paths(target, path, ctx)
    }
  }

  private ensureCommonRegistered(schema: JSONSchema7): void {
    if (this.addedRefs.has(schema)) return

    // Process recursively first (handles nested $id dependencies)
    this.processSchema(schema)

    this.ajv.addSchema(schema)
    this.addedRefs.add(schema)

    const id = schema.$id
    assert(id, 'SchemaRegistry: ensureCommonRegistered called on schema without $id')
    this.idToSchema.set(id, schema)

    if (!this.manuallyRegistered.has(schema)) {
      this.commonSchemas.set(id, schema)
    }
  }

  /**
   * Take a sub-schema's pre-computed int64 envelope and prefix with the current path.
   */
  private composeInt64Paths(subSchema: JSONSchema7, currentPath: string, ctx: WalkContext): void {
    const sub = this.int64PathCache.get(subSchema)
    assert(sub, 'SchemaRegistry: composeInt64Paths called for a schema with no cached envelope')
    for (const p of sub.paths) {
      ctx.paths.push(`${currentPath}${p}`)
    }
    for (const [prefix, excludeKeys] of sub.starMap) {
      ctx.starEntries.push([`${currentPath}${prefix}`, excludeKeys])
    }
  }

  /**
   * Compose int64 paths for an already-resolved additionalProperties schema.
   * Adds a `*` prefix to sub-schema paths and records a starMap entry with all
   * static property keys so the hydrator skips them.
   */
  private collectAdditionalPropertiesInt64(
    parentSchema: JSONSchema7,
    resolvedSchema: JSONSchema7,
    path: string,
    ctx: WalkContext,
  ): void {
    const sub = this.int64PathCache.get(resolvedSchema)
    assert(
      sub,
      'SchemaRegistry: collectAdditionalPropertiesInt64 called for a schema with no cached envelope',
    )
    if (sub.paths.length === 0 && sub.starMap.size === 0) return

    // Add starMap entry with all static property keys to skip
    const staticKeys = this.getStaticPropertyKeys(parentSchema)
    if (staticKeys.length > 0) {
      ctx.starEntries.push([`${path}.*`, staticKeys])
    }

    // Compose sub-schema's paths with * prefix
    for (const p of sub.paths) {
      ctx.paths.push(`${path}.*${p}`)
    }
    // Compose sub-schema's starMap with * prefix
    for (const [prefix, keys] of sub.starMap) {
      ctx.starEntries.push([`${path}.*${prefix}`, keys])
    }
  }

  /**
   * All property keys from the parent's `properties` — these are statically defined
   * and should be skipped by the hydrator when iterating dynamic additionalProperties.
   */
  private getStaticPropertyKeys(parentSchema: JSONSchema7): readonly string[] {
    if (!parentSchema.properties) return []
    return Object.keys(parentSchema.properties)
  }
}
