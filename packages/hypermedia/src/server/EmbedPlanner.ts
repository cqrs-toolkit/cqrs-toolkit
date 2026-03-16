import { Err, Ok, Result } from '@meticoeus/ddd-es'
import { AnySpec, EmbeddedOutput, ManyMap, OneMap, ParamMapFromSpecs } from '../include/core.js'
import type { Querystring } from '../shared-types.js'
import { TooManyIncludesException, toUpstreamException } from './exceptions.js'
import { buildIncludeSchema, IncludeMetaCollectionSchema } from './meta.js'

export interface EmbedPlannerOptions {
  /** Hard cap per route; default 3 (applies to *requested* tokens only, not auto-added parents) */
  maxIncludes?: number
}

export interface ResolveOptions {
  /**
   * Skip retrieval for these class tokens (already loaded in main query).
   * Output will include an entry with { skipped: true }.
   */
  skip?: string[]

  /**
   * Provide parent keys explicitly (used when the parent is skipped or not requested).
   * Example: parentKeys['storage:FileObject'] = ['f_1', 'f_2']
   */
  parentKeys?: { [className: string]: string[] }
}

/**
 * Planner that:
 *  - validates tokens
 *  - auto-adds required parents (when a child is requested and the parent is NOT skipped)
 *    — these auto-added parents do NOT count against maxIncludes
 *  - resolves in two parallel phases (no auto-nesting):
 *      Phase 1: roots + children with skipped parents
 *      Phase 2: children with non-skipped parents (derive keys from parent maps)
 *  - supports skip + parentKeys
 *  - is silent when keys are empty/absent (map: undefined)
 */
export class EmbedPlanner<L, C, Specs extends readonly AnySpec<L, C>[]> {
  private byClass = new Map<string, AnySpec<L, C>>()
  private readonly maxIncludes: number

  public readonly includes: readonly string[]

  get schema(): IncludeMetaCollectionSchema {
    return buildIncludeSchema(this.includes)
  }

  constructor(
    private readonly specs: Specs,
    opts: EmbedPlannerOptions = {},
  ) {
    const includes: string[] = []
    for (const spec of specs) {
      this.byClass.set(spec.className, spec)
      includes.push(spec.className)
    }
    this.includes = includes
    this.maxIncludes = opts.maxIncludes ?? 3
  }

  /**
   * Resolve requested embeds (all-or-nothing).
   * - Err(BadRequestException) for unknown tokens / too many includes.
   * - Err(5xx Exception) if any resolver throws.
   * - Ok(EmbeddedOutput) otherwise.
   */
  async resolve(
    qs: Querystring,
    // params object typed per class: { 'pms:DataTag': DataTagParams; ... }
    params: Partial<ParamMapFromSpecs<Specs>>,
    locals: L,
    context: C,
    options: ResolveOptions = {},
  ): Promise<Result<EmbeddedOutput<Specs>>> {
    try {
      const { requested } = this.getIncludeTokens(qs)

      if (requested.length > this.maxIncludes) {
        return Err(new TooManyIncludesException(this.maxIncludes, requested))
      }

      const skipSet = new Set(options.skip ?? [])
      const parentKeysFromOpts = options.parentKeys ?? {}

      // Expand with parents (parents are auto-added if child is requested and parent NOT skipped)
      const desired = this.expandWithParents(requested, skipSet)

      // Prepare output shape upfront (with cardinalities)
      const out: Partial<EmbeddedOutput<Specs>> = {}
      for (const cls of desired) {
        const spec = this.byClass.get(cls)!
        out[cls as keyof EmbeddedOutput<Specs>] = {
          cardinality: spec.cardinality,
          ...(requested.includes(cls) && skipSet.has(cls) ? { skipped: true } : {}),
        } as EmbeddedOutput<Specs>[keyof EmbeddedOutput<Specs>]
      }

      // Partition desired into roots vs children
      const roots: string[] = []
      const children: string[] = []
      for (const cls of desired) {
        const spec = this.byClass.get(cls)!
        const parentClass = spec.parent?.className
        if (parentClass) children.push(cls)
        else roots.push(cls)
      }

      // Further partition children for phase 1 vs phase 2
      // Phase 1: children with skipped parents (they can use options.parentKeys)
      // Phase 2: children with non-skipped parents (need parent maps)
      const childrenWithSkippedParents: string[] = []
      const childrenWithResolvedParents: string[] = []

      for (const child of children) {
        const childSpec = this.byClass.get(child)!
        const parentClass = childSpec.parent?.className
        if (parentClass && skipSet.has(parentClass)) {
          childrenWithSkippedParents.push(child)
        } else {
          childrenWithResolvedParents.push(child)
        }
      }

      // Cache of resolved maps per class
      const resolvedMaps = new Map<string, OneMap | ManyMap | undefined>()

      // -------- Phase 1 (parallel): roots + children whose parents are skipped --------
      await Promise.all(
        [...roots, ...childrenWithSkippedParents].map((cls) =>
          this.resolveToken({
            cls,
            params,
            locals,
            context,
            desired,
            skipSet,
            parentKeysFromOpts,
            allowDeriveFromParentMap: false,
            resolvedMaps,
            out,
          }),
        ),
      )

      // -------- Phase 2 (parallel): children whose parents are NOT skipped --------
      await Promise.all(
        childrenWithResolvedParents.map((cls) =>
          this.resolveToken({
            cls,
            params,
            locals,
            context,
            desired,
            skipSet,
            parentKeysFromOpts,
            allowDeriveFromParentMap: true,
            resolvedMaps,
            out,
          }),
        ),
      )

      return Ok(out as EmbeddedOutput<Specs>)
    } catch (err) {
      return Err(toUpstreamException(err))
    }
  }

  // Only repeated parameters; commas are NOT split (so "?include=a,b" is an unknown token)
  private getIncludeTokens(qs: Querystring): { requested: string[]; unknown: string[] } {
    const raw = qs?.include
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : []
    const tokens = arr.map((s) => s.trim()).filter(Boolean)

    const seen = new Set<string>()
    const requested: string[] = []
    // ignore these, they are external
    const unknown: string[] = []

    for (const t of tokens) {
      if (!this.byClass.has(t)) {
        if (!unknown.includes(t)) unknown.push(t)
        continue
      }
      if (!seen.has(t)) {
        seen.add(t)
        requested.push(t)
      }
    }
    return { requested, unknown }
  }

  /**
   * Auto-include parents when:
   *  - a child is requested,
   *  - the child declares a parentClass,
   *  - the parent is NOT skipped.
   * Parents added here do NOT count against maxIncludes.
   */
  private expandWithParents(requested: string[], skipSet: Set<string>): string[] {
    const desiredSet = new Set<string>(requested)
    for (const cls of requested) {
      const spec = this.byClass.get(cls)
      const parentClass = spec?.parent?.className
      if (parentClass && !skipSet.has(parentClass)) {
        desiredSet.add(parentClass)
      }
    }
    return Array.from(desiredSet)
  }

  /**
   * Resolve one token with derived keys & skip handling.
   * - Merges derived `keys` into resolver params before calling `spec.resolve`.
   * - If skipped or no keys -> map stays undefined (silent).
   */
  private async resolveToken(opts: {
    cls: string
    params: Partial<ParamMapFromSpecs<Specs>>
    locals: L
    context: C
    desired: string[]
    skipSet: Set<string>
    parentKeysFromOpts: { [className: string]: string[] }
    allowDeriveFromParentMap: boolean
    resolvedMaps: Map<string, OneMap | ManyMap | undefined>
    out: Partial<EmbeddedOutput<Specs>>
  }): Promise<void> {
    const {
      cls,
      params,
      locals,
      context,
      desired,
      skipSet,
      parentKeysFromOpts,
      allowDeriveFromParentMap,
      resolvedMaps,
      out,
    } = opts
    const spec = this.byClass.get(cls)!
    const entry = out[cls as keyof EmbeddedOutput<Specs>]!
    const isSkipped = skipSet.has(cls)

    // Determine keys (silent when empty)
    const keys = this.deriveKeysForClass({
      cls,
      spec,
      desired,
      skipSet,
      params,
      resolvedMaps,
      parentKeysFromOpts,
      allowDeriveFromParentMap,
    })

    if (isSkipped) {
      // If user explicitly requested and skipped, `skipped: true` is already set in out initialization.
      ;(entry as any).map = undefined
      resolvedMaps.set(cls, undefined)
      return
    }

    if (!keys || keys.length === 0) {
      ;(entry as any).map = undefined
      resolvedMaps.set(cls, undefined)
      return
    }

    // Merge derived keys into resolver params
    const rawParams = (params as Record<string, any> | undefined)?.[cls]
    const effectiveParams =
      rawParams && Array.isArray(rawParams.keys) && rawParams.keys.length > 0
        ? rawParams
        : { ...(rawParams ?? {}), keys }

    const map = await spec.resolve(effectiveParams, locals, context)
    ;(entry as any).map = map
    resolvedMaps.set(cls, map)
  }

  /**
   * Key derivation rule (deterministic, silent on empty):
   *  1) params[cls].keys if present and non-empty
   *  2) if spec has parent:
   *     a) options.parentKeys[parentClass] if present and non-empty
   *     b) else (only when allowDeriveFromParentMap=true), if parentClass is in desired AND not skipped,
   *        use keys from parent's resolved map (its keys)
   *  3) otherwise undefined (resolver won't be called)
   */
  private deriveKeysForClass(opts: {
    cls: string
    spec: AnySpec<L, C>
    desired: string[]
    skipSet: Set<string>
    params: Partial<Record<string, { keys?: string[] }>> | undefined
    resolvedMaps: Map<string, OneMap | ManyMap | undefined>
    parentKeysFromOpts: { [className: string]: string[] }
    allowDeriveFromParentMap: boolean
  }): string[] | undefined {
    const {
      cls,
      spec,
      desired,
      skipSet,
      params,
      resolvedMaps,
      parentKeysFromOpts,
      allowDeriveFromParentMap,
    } = opts

    // (1) explicit keys via params
    const paramKeys = (params as any)?.[cls]?.keys as string[] | undefined
    if (Array.isArray(paramKeys) && paramKeys.length > 0) return paramKeys

    // (2) parent-based derivation
    const parentClass = spec.parent?.className
    if (!parentClass) return undefined

    // 2a) explicit parent keys via options
    const optKeys = parentKeysFromOpts[parentClass]
    if (Array.isArray(optKeys) && optKeys.length > 0) return optKeys

    // 2b) derive from a resolved parent map — only when allowed and parent is present & not skipped
    if (allowDeriveFromParentMap && desired.includes(parentClass) && !skipSet.has(parentClass)) {
      const parentMap = resolvedMaps.get(parentClass)
      if (!parentMap) return undefined

      const derivedIds = this.collectIdsFromParentMap(parentMap)
      return derivedIds.length > 0 ? derivedIds : undefined
    }

    // No keys
    return undefined
  }

  private collectIdsFromParentMap(map: OneMap | ManyMap): string[] {
    const ids: string[] = []
    const seen = new Set<string>()

    // Values can be a scalar ResourceDescriptor or an array of ResourceDescriptor
    for (const value of (map as Map<unknown, unknown>).values()) {
      if (Array.isArray(value)) {
        for (const rd of value) {
          const id = (rd as any)?.properties?.id
          if (typeof id === 'string' && !seen.has(id)) {
            seen.add(id)
            ids.push(id)
          }
        }
      } else if (value) {
        const id = (value as any)?.properties?.id
        if (typeof id === 'string' && !seen.has(id)) {
          seen.add(id)
          ids.push(id)
        }
      }
    }
    return ids
  }
}
