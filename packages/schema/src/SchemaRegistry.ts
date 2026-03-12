import type { Ajv, ValidateFunction } from 'ajv'
import type { JSONSchema7 } from 'json-schema'
import assert from 'node:assert'
import type { HydrationPlan, SchemaVisitor } from './types.js'
import {
  EMPTY_PLAN,
  type WalkContext,
  applyHydration,
  buildPlanFromContext,
  composeAdditionalPropertiesFromPlan,
  getOrCreateContext,
} from './utils.js'

/**
 * Walks JSON Schema trees, discovers reusable sub-schemas (those with `$id`), registers them
 * with AJV, replaces inline definitions with `$ref` pointers, and computes hydration plans
 * for runtime value conversion via pluggable visitors.
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
  private planCache = new Map<JSONSchema7, HydrationPlan>()
  private idToSchema = new Map<string, JSONSchema7>()

  constructor(
    private ajv: Ajv,
    public readonly visitors: readonly SchemaVisitor[],
  ) {}

  /**
   * Walk schema tree, discover $id sub-schemas, replace with $ref, cache hydration plan.
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

  /** Cached hydration plan for a registered schema. */
  public getHydrationPlan(schema: JSONSchema7): HydrationPlan {
    return this.planCache.get(schema) ?? EMPTY_PLAN
  }

  /** Apply all visitor hydrations for a registered schema. */
  public hydrate(data: unknown, schema: JSONSchema7): void {
    const plan = this.planCache.get(schema)
    if (!plan) return
    for (const [name, envelope] of plan) {
      if (envelope.paths.length === 0) continue
      const visitor = this.visitors.find((v) => v.name === name)
      assert(visitor, `SchemaRegistry: visitor "${name}" not found`)
      applyHydration(data, envelope, visitor.hydrate)
    }
  }

  private processSchema(schema: JSONSchema7): void {
    if (this.planCache.has(schema)) return
    const ctx = new Map<string, WalkContext>()
    this.walkSchema(schema, '', ctx)
    this.planCache.set(schema, buildPlanFromContext(ctx))
  }

  private walkSchema(schema: JSONSchema7, path: string, ctx: Map<string, WalkContext>): void {
    // Leaf detection — iterate all visitors
    for (const visitor of this.visitors) {
      if (visitor.match(schema)) {
        getOrCreateContext(ctx, visitor.name).paths.push(path)
      }
    }

    // properties
    if (schema.properties) {
      for (const [key, child] of Object.entries(schema.properties)) {
        if (typeof child === 'boolean') continue
        const childPath = `${path}.${key}`
        if (child.$id) {
          this.ensureCommonRegistered(child)
          this.composePaths(child, childPath, ctx)
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
            this.composePaths(item, itemPath, ctx)
            schema.items[i] = { $ref: item.$id }
          } else {
            this.walkSchema(item, itemPath, ctx)
          }
        }
      } else {
        const itemPath = `${path}[]`
        if (schema.items.$id) {
          this.ensureCommonRegistered(schema.items)
          this.composePaths(schema.items, itemPath, ctx)
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
          this.composePaths(branch, path, ctx)
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
        this.collectAdditionalProperties(schema, addProps, path, ctx)
        schema.additionalProperties = { $ref: addProps.$id }
      } else if (addProps.$ref) {
        const target = this.idToSchema.get(addProps.$ref)
        assert(target, `SchemaRegistry: $ref "${addProps.$ref}" references an unregistered schema`)
        this.collectAdditionalProperties(schema, target, path, ctx)
      } else {
        this.processSchema(addProps)
        this.collectAdditionalProperties(schema, addProps, path, ctx)
      }
    }

    // Existing $ref (pre-existing, not placed by this processor)
    if (schema.$ref) {
      const target = this.idToSchema.get(schema.$ref)
      assert(target, `SchemaRegistry: $ref "${schema.$ref}" references an unregistered schema`)
      this.composePaths(target, path, ctx)
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
   * Take a sub-schema's pre-computed hydration plan and prefix with the current path.
   */
  private composePaths(
    subSchema: JSONSchema7,
    currentPath: string,
    ctx: Map<string, WalkContext>,
  ): void {
    const subPlan = this.planCache.get(subSchema)
    assert(subPlan, 'SchemaRegistry: composePaths called for a schema with no cached plan')
    for (const [name, envelope] of subPlan) {
      const wctx = getOrCreateContext(ctx, name)
      for (const p of envelope.paths) {
        wctx.paths.push(`${currentPath}${p}`)
      }
      for (const [prefix, excludeKeys] of envelope.starMap) {
        wctx.starEntries.push([`${currentPath}${prefix}`, excludeKeys])
      }
    }
  }

  /**
   * Compose hydration paths for an already-resolved additionalProperties schema.
   * Delegates to the shared composition function.
   */
  private collectAdditionalProperties(
    parentSchema: JSONSchema7,
    resolvedSchema: JSONSchema7,
    path: string,
    ctx: Map<string, WalkContext>,
  ): void {
    const subPlan = this.planCache.get(resolvedSchema)
    assert(
      subPlan,
      'SchemaRegistry: collectAdditionalProperties called for a schema with no cached plan',
    )
    composeAdditionalPropertiesFromPlan(parentSchema, subPlan, path, ctx)
  }
}
