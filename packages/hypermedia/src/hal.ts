import { kebabCase } from 'moderndash'
import assert from 'node:assert'
import { HypermediaTypes } from './types.js'

type RFCTemplate = HypermediaTypes.RFCTemplate

export namespace HAL {
  /**
   * Standard Link Object for hypermedia (HAL-style).
   * Describes how a client can navigate to related resources.
   */
  export interface LinkObject {
    /**
     * Target URI of the link.
     * May be absolute or relative to the current resource.
     */
    href: string

    /**
     * Indicates that the `href` contains URI template variables
     * (RFC 6570). Clients must expand before using.
     */
    templated?: boolean

    /**
     * The media type (MIME type) expected when dereferencing
     * this link. Example: "application/hal+json".
     */
    type?: string

    /**
     * A URI identifying a deprecation notice for the link.
     * Indicates clients should avoid using this relation.
     */
    deprecation?: string

    /**
     * Secondary key to distinguish multiple links
     * with the same relation type. Example: two `thumbnail`
     * links with different sizes can be disambiguated by `name`.
     */
    name?: string

    /**
     * A URI that hints at the profile (specification or
     * constraints) of the target resource. Example:
     * "https://example.com/profiles/task".
     */
    profile?: string

    /**
     * Human-readable title describing the link's target.
     * Useful for UIs but not required for clients.
     */
    title?: string

    /**
     * The language of the link's target resource.
     * Example: "en", "fr", "en-US".
     */
    hreflang?: string
  }

  /** Exact representation of THIS resource. Not templated. */
  export interface SelfLink {
    /** Target URI (absolute or relative). */
    href: string
    /** Media type served at `href` (e.g., "application/hal+json"). */
    type?: string
    /** Profile/constraints URI or URN for this representation. */
    profile?: string
  }

  /** Parent collection for this resource. Typically not templated. */
  export interface CollectionLink {
    /** Target URI of the collection. */
    href: string
    templated?: true
    /** Media type served at `href` (e.g., "application/hal+json"). */
    type?: string
    /** Profile/constraints URI or URN for the collection representation. */
    profile?: string
  }

  /** String shape that ensures a `{rel}` placeholder is present. */
  type CurieHref = `${string}{rel}${string}`

  /** CURIE prefix definition (HAL). Always templated with `{rel}`. */
  export interface CurieLink {
    /** Template URI containing `{rel}` placeholder. */
    href: CurieHref
    /** CURIE prefix (e.g., "pms"). */
    name: string
    /** Must be true for CURIEs. */
    templated: true
  }

  /** Default _links. May be extended by each route. */
  export interface Links {
    /** Canonical link to this exact representation */
    self: SelfLink
    /** Canonical parent collection */
    collection?: CollectionLink
    /** CURIE prefix definitions */
    curies?: CurieLink[]
  }

  interface CollectionDefinitionLike {
    /**
     * Collection "kind" is descriptive metadata (used for tooling/docs/UI organization),
     * not a behavioral switch.
     *
     * - Omit or set to 'canonical' for the canonical collection for a resource type.
     * - Set to 'view' for a surface collection that returns canonical resources but lives
     *   under a different path (scoped listings, cross-aggregate projections, etc.).
     */
    kind?: 'canonical' | 'view' // default 'canonical'

    /** IRI of the resources contained in this collection (used for CURIE inference and Hydra) */
    itemClass: string

    /**
     * Optional base href for this collection surface (NO query string).
     *
     * Usually omitted: the base href is derived from `searchTemplate.template` by stripping
     * the supported RFC6570 query expansion suffix `{?...}`.
     *
     * Provide only when that derivation is not possible/implemented (e.g. unusual RFC6570 forms).
     *
     * IMPORTANT:
     * - This may contain *collection-level* path tokens (e.g. `/api/chat/rooms/{roomId}/file-objects`).
     * - Those tokens MUST be resolvable using `CollectionDescriptor.context` before member rendering.
     * - After expansion, the resulting href MUST NOT contain any `{...}` tokens.
     */
    href?: RFCTemplate

    /** RFC6570 template for searching this collection (HAL: _links.search; Hydra: IriTemplate) */
    searchTemplate: { template: RFCTemplate }

    /**
     * If true, each direct member's `_links.collection` will point back to THIS collection surface
     * (expanded from the collection descriptor context), instead of using the member resource's
     * own `ResourceDefinition.collectionLink`.
     *
     * Use this when the collection surface is a meaningful navigational container for its members,
     * even if the members are canonical resources from another bounded context / path.
     *
     * Examples:
     * - `/api/chat/rooms/{roomId}/file-objects` returns `storage:FileObject` members but the
     *   "back" link should return to the room-scoped listing.
     * - A scoped listing under a parent resource where UI navigation expects "back to this scope".
     *
     * Notes:
     * - This applies ONLY to *direct collection members*.
     * - Embedded resources MUST NOT inherit this behavior.
     * - The computed surface href is a base href (no pagination/query) and must be fully resolved
     *   before rendering members.
     */
    useSurfaceAsMemberCollection?: boolean

    /** Optional extra links on the collection itself (`_links`). */
    extraLinks?: Array<{
      rel: string
      href: RFCTemplate
      title?: string
      templated?: boolean
      /** When true, render this rel as an array (even if there's only 1). */
      collection?: boolean
    }>

    /** Base href template for CURIEs; default `/rels/{prefix}/{rel}`. */
    curiesBaseHref?: string
  }

  export class CollectionDefinitionRep {
    readonly kind: 'canonical' | 'view'
    readonly itemClass: string
    readonly href: RFCTemplate
    readonly searchTemplate: { template: RFCTemplate }
    readonly extraLinks?: CollectionDefinitionLike['extraLinks']
    readonly curiesBaseHref?: string
    readonly useSurfaceAsMemberCollection?: boolean

    constructor(def: CollectionDefinitionLike) {
      this.kind = def.kind ?? 'canonical'
      this.itemClass = def.itemClass
      this.searchTemplate = def.searchTemplate
      this.extraLinks = def.extraLinks
      this.curiesBaseHref = def.curiesBaseHref
      this.useSurfaceAsMemberCollection = def.useSurfaceAsMemberCollection

      this.href = def.href ?? stripQueryExpansion(def.searchTemplate.template)

      // If derivation failed to remove query expansion, we still accept it as a template string,
      // but it must represent a base href (no pagination/query). If you want, you can tighten this
      // to throw when it still contains "{?" etc.
      assert(
        this.href,
        `[HAL.CollectionDefinitionRep] Missing href and could not derive from searchTemplate: ${String(
          def.searchTemplate?.template,
        )}`,
      )

      assert(
        !/\{[?&]/.test(this.href) && !this.href.includes('?'),
        `[HAL.CollectionDefinitionRep] href must be a base href (no query expansion / no '?').\n` +
          `href=${this.href}\n` +
          `searchTemplate=${this.searchTemplate.template}\n` +
          `itemClass=${this.itemClass}`,
      )
    }

    static from(def: CollectionDefinition): CollectionDefinitionRep {
      return def instanceof CollectionDefinitionRep ? def : new CollectionDefinitionRep(def)
    }

    /**
     * Compute the concrete base href for this collection surface using collection-level context.
     * This *must* fully resolve the template (no remaining `{...}`), otherwise we throw an error.
     */
    expandHrefBase(collectionContext?: Record<string, any>): string {
      const { value, unresolved } = expandInternal(this.href, {}, collectionContext)
      assert(
        unresolved.size === 0,
        [
          `[HAL.CollectionDefinition]: unable to fully resolve collection href base template.\n`,
          `template=${this.href}\n`,
          `resolved=${value}\n`,
          `unresolved=${[...unresolved].join(', ')}\n`,
          `itemClass=${this.itemClass}\n`,
          `Hint: provide missing tokens via CollectionDescriptor.context or set CollectionDefinition.href.`,
        ].join(''),
      )
      return value
    }
  }

  export type CollectionDefinition = CollectionDefinitionLike | CollectionDefinitionRep

  export interface ResourceDefinition {
    /** class IRI */
    class: string
    /** Default value */
    linkDensity?: 'omit' | 'lean' | 'full'
    /** builds 'self' href */
    idTemplate: RFCTemplate
    /** sets `type` on SELF link (e.g. '{contentType}') */
    selfTypeTemplate?: RFCTemplate
    /** link back to parent collection */
    collectionLink?: {
      rel?: string
      href: RFCTemplate
      templated?: boolean
      /** When true, render this rel as an array (even if there's only 1). */
      collection?: boolean
    }
    extraLinks?: Array<{
      rel: string
      href: RFCTemplate
      type?: RFCTemplate
      title?: string
      templated?: boolean
      /** When true, render this rel as an array (even if there's only 1). */
      collection?: boolean
    }>

    /**
     * Child collections (to-many). Use this for lists you might embed as arrays and/or add collection links for.
     * For 1-to-1 related resources, use `embeddedResources` instead.
     */
    children?: ChildCollectionDefinition[]

    /**
     * One-to-one related resources to embed as plain objects on this resource.
     * Use this for parent/related metadata (not child collections).
     * - The rel defaults to prefix:kebab-case(localPart) derived from `class`, unless overridden by `embedRel`.
     * - If the descriptor provides an array for this relation, the first element is used.
     * - If the value is null/undefined (or an empty array), the embed is omitted.
     */
    embeddedResources?: EmbeddedResourceDefinition[]

    /** default `/rels/{prefix}/{rel}` if omitted */
    curiesBaseHref?: string
  }

  export interface ChildCollectionDefinition {
    /** child class IRI, e.g. 'storage:Rendition' */
    class: string
    /**
     * HAL rel name to embed children under.
     * If omitted, formatter derives it from `class`
     * (prefix:kebabCase(localPart)).
     */
    rel?: string
    embed?: {
      /** When true, render this rel as an array (even if there's only 1). */
      collection?: boolean
    }
    /**
     * Configure a link for the child collection on the parent resource.
     * This affects _links only (whether or not the child is embedded).
     */
    collectionLink?: {
      href: RFCTemplate
      templated?: boolean
      /** Only these tokens will be resolved at the parent; others stay templated */
      resolveTokens?: string[]
    }
  }

  export interface EmbeddedResourceDefinition {
    /** related resource class IRI (e.g. 'iam:TeamCategory') */
    class: string
    /**
     * Override the default rel (prefix:kebab-case(localPart)).
     * Useful for cases where the rel differs from the class-local-name.
     */
    embedRel?: string
  }

  /** Optional renderer options for HAL emitters. */
  export interface RendererOptions {
    /** When 'lean', only emit self/collection/curies for each item. */
    linkDensity?: 'omit' | 'lean' | 'full'

    /**
     * Internal context set by HAL.fromCollection when a collection chooses to make
     * members link back to the current surface (useSurfaceAsMemberCollection).
     *
     * Only applies to direct collection members. Embedded resources MUST NOT inherit it.
     */
    __collectionContext?: {
      /** Base href for the current collection surface (no query/pagination). */
      memberCollectionHref: string
    }
  }

  function getChildRel(embeddedPrefixes: Set<string> | null, className: string, rel?: string) {
    if (rel) {
      if (embeddedPrefixes) {
        const { prefix } = splitCurie(rel)
        if (prefix) embeddedPrefixes.add(prefix)
      }
      return rel
    }

    const { prefix, local } = splitCurie(className)
    if (prefix) embeddedPrefixes?.add(prefix)
    return prefix ? `${prefix}:${kebabCase(local)}` : kebabCase(local)
  }

  export function fromResource(
    desc: HypermediaTypes.ResourceDescriptor,
    defs: ResourceDefinition[],
    opts?: RendererOptions,
  ): Dict {
    const body: Dict = { ...desc.properties }
    const def = findDef(defs, desc.class)

    // === EMBEDDED ============================================================
    const embeddedPrefixes = new Set<string>()
    if (desc.embedded) {
      const embedded: Dict = {}
      for (const [childClassIri, items] of Object.entries(desc.embedded)) {
        const childDef = findDef(defs, childClassIri)

        // derive rel + track prefixes for CURIEs
        let rel = childDef
          ? getChildRel(embeddedPrefixes, childDef.class)
          : getChildRel(embeddedPrefixes, childClassIri)

        // children[] is for to-many collections (not used to shape 1-to-1)
        const parentChildCfg = def?.children?.find((c) => c.class === childClassIri)
        if (parentChildCfg?.rel) {
          rel = getChildRel(embeddedPrefixes, childClassIri, parentChildCfg.rel)
        }

        // embeddedResources[] is for one-to-one embeds; overrides rel if set
        const oneToOneCfg = def?.embeddedResources?.find((e) => e.class === childClassIri)
        if (oneToOneCfg?.embedRel) {
          const { prefix } = splitCurie(oneToOneCfg.embedRel)
          if (prefix) embeddedPrefixes.add(prefix)
          rel = oneToOneCfg.embedRel
        }

        // Only direct members of a collection surface using `useSurfaceAsMemberCollection`
        // should get the overridden collection link.
        // Embedded resources must render normally, so strip the view context for nested renders.
        const childOpts = opts?.__collectionContext
          ? { ...opts, __collectionContext: undefined }
          : opts

        const materialize = (v: any) =>
          isResourceDescriptor(v) ? fromResource(v, defs, childOpts) : v

        if (oneToOneCfg) {
          let value: any
          if (Array.isArray(items)) {
            value = items.length > 0 ? items[0] : null
          } else {
            value = items
          }
          if (value == null) continue
          embedded[rel] = materialize(value)
          continue
        }

        // to-many behavior (force array when collection=true)
        if (Array.isArray(items)) {
          const arr = items.map((i) => materialize(i))
          if (arr.length > 0) embedded[rel] = arr
        } else if (items) {
          const v = materialize(items)
          if (parentChildCfg?.embed?.collection) {
            // force array shape even for a single item
            embedded[rel] = [v]
          } else {
            embedded[rel] = v
          }
        }
      }
      if (Object.keys(embedded).length) body._embedded = embedded
    }

    // === LINKS ===============================================================
    const { links, forceArrayRels } = buildLinksForResource(desc, defs, embeddedPrefixes, opts)
    if (Object.keys(links).length) {
      body._links = flattenLinks(links, forceArrayRels)
    }

    return body
  }

  export function formsFromActions(actions: HypermediaTypes.ActionTemplate[]): Record<string, any> {
    const out: Record<string, any> = {}
    for (const a of actions) {
      out[a.name] = {
        title: a.name,
        method: a.method,
        target: a.target,
        contentType: a.contentType ?? 'application/json',
        properties: a.properties,
      }
      if (a.schemaRef) out[a.name].schema = { $ref: a.schemaRef }
    }
    return out
  }

  export function fromCollection(
    desc: HypermediaTypes.CollectionDescriptor,
    defs: ResourceDefinition[],
    cdefSrc: CollectionDefinition,
    opts?: RendererOptions,
  ): Dict {
    const cdef = CollectionDefinitionRep.from(cdefSrc)
    const links: Dict = {}
    const p = desc.page
    links.self = { href: p.self }
    if (p.first) links.first = { href: p.first }
    if (p.prev) links.prev = { href: p.prev }
    if (p.next) links.next = { href: p.next }
    if (p.last) links.last = { href: p.last }

    links.search = { href: cdef.searchTemplate.template, templated: true }

    // extra collection links + track prefixes for CURIEs
    const usedPrefixes = new Set<string>()
    const push = (rel: string, val: Dict, forceArr?: boolean) => {
      if (rel === 'curies') {
        ;(links.curies ??= []).push(val)
        return
      }
      const cur = links[rel]
      if (!cur) links[rel] = forceArr ? [val] : val
      else links[rel] = Array.isArray(cur) ? (cur.push(val), cur) : [cur, val]
    }
    const split = (curie: string) => {
      const i = curie.indexOf(':')
      return i > 0
        ? { prefix: curie.slice(0, i), local: curie.slice(i + 1) }
        : { prefix: '', local: curie }
    }

    cdef.extraLinks?.forEach((l) => {
      push(
        l.rel,
        {
          href: l.href,
          ...(l.title && { title: l.title }),
          ...(l.templated && { templated: true }),
        },
        !!l.collection,
      )
      const { prefix } = split(l.rel)
      if (prefix) usedPrefixes.add(prefix)
    })

    const memberCollectionHref = cdef.expandHrefBase(desc.context)
    const memberOpts = cdef.useSurfaceAsMemberCollection
      ? { ...opts, __collectionContext: { memberCollectionHref } }
      : opts

    const members = desc.members.map((m) =>
      'properties' in (m as any)
        ? fromResource(m as HypermediaTypes.ResourceDescriptor, defs, memberOpts)
        : m,
    )

    const body: Dict = { _links: links, _embedded: { item: members } }
    if (typeof desc.totalItems === 'number') body.totalItems = desc.totalItems
    if (desc.counts) body._counts = desc.counts

    // CURIEs: prefix from itemClass + any extraLinks
    const curiesBase = cdef.curiesBaseHref ?? '/rels/{prefix}/{rel}'
    const i = cdef.itemClass.indexOf(':')
    if (i > 0) usedPrefixes.add(cdef.itemClass.slice(0, i))
    const curies = [...usedPrefixes].map((name) => ({
      name,
      href: curiesBase.replace('{prefix}', name).replace('{rel}', '{rel}'),
      templated: true,
    }))
    if (curies.length) (body._links.curies ??= []).push(...curies)

    return body
  }

  function isResourceDescriptor<T extends object = any>(
    x: any,
  ): x is HypermediaTypes.ResourceDescriptor<T> {
    return x && typeof x === 'object' && typeof x.class === 'string' && 'properties' in x
  }

  type Dict = Record<string, any>

  function splitCurie(curie: string): { prefix: string; local: string } {
    const i = curie.indexOf(':')
    return i > 0
      ? { prefix: curie.slice(0, i), local: curie.slice(i + 1) }
      : { prefix: '', local: curie }
  }

  /** Resolve a dotted path against a source object. */
  function resolvePath(expr: string, src?: Dict): unknown {
    if (!src) return undefined
    let cur: any = src
    for (const k of expr.split('.')) {
      if (cur == null || typeof cur !== 'object') return undefined
      cur = cur[k as keyof typeof cur]
    }
    return cur
  }

  /**
   * Expand `{nested.token}` occurrences in `tpl` using `model` first, then `ctx`.
   * - `allowed` (if provided) whitelists tokens **exactly** (full dot.separated path).
   * - Tracks which tokens could not be resolved.
   */
  function expandInternal(
    tpl: string,
    model: Dict,
    ctx?: Dict,
    allowed?: Set<string>,
  ): { value: string; unresolved: Set<string> } {
    const unresolved = new Set<string>()

    const value = tpl.replace(/\{([^}]+)\}/g, (m, expr: string) => {
      if (allowed && !allowed.has(expr)) {
        unresolved.add(expr)
        return m // keep templated
      }

      const fromModel = resolvePath(expr, model)
      if (fromModel != null) {
        return String(fromModel)
      }

      const fromCtx = resolvePath(expr, ctx)
      if (fromCtx != null) {
        return String(fromCtx)
      }

      // unresolved: keep token
      unresolved.add(expr)
      return m
    })

    return { value, unresolved }
  }

  /** Loose expansion: keep unresolved tokens intact. (Back-compat behavior.) */
  function expand(tpl: string, model: Dict, ctx?: Dict, allowed?: Set<string>): string {
    return expandInternal(tpl, model, ctx, allowed).value
  }

  /**
   * Optional expansion:
   * - Returns `undefined` if any tokens remain unresolved OR the result is empty.
   * - Useful for optional attributes like link `type`/`title`.
   */
  function expandOptional(
    tpl: string | undefined,
    model: Dict,
    ctx?: Dict,
    allowed?: Set<string>,
  ): string | undefined {
    if (!tpl) return undefined
    const { value, unresolved } = expandInternal(tpl, model, ctx, allowed)
    if (unresolved.size > 0) return undefined
    if (value == null || value === '') return undefined
    return value
  }

  function pushLinkShape(links: Dict, rel: string, value: Dict) {
    if (rel === 'curies') {
      ;(links.curies ??= []).push(value)
      return
    }
    const current = links[rel]
    if (!current) {
      links[rel] = value
    } else if (Array.isArray(current)) {
      current.push(value)
    } else {
      // was scalar; becomes array when a second link arrives
      links[rel] = [current, value]
    }
  }

  function findDef(defs: ResourceDefinition[], classIri?: string) {
    return classIri ? defs.find((d) => d.class === classIri) : undefined
  }

  function flattenLinks(
    links: Record<string, any>,
    forceArrayRels: Set<string> = new Set(['curies']),
  ): Record<string, any> {
    const out: Record<string, any> = {}
    for (const [rel, v] of Object.entries(links)) {
      if (forceArrayRels.has(rel)) {
        out[rel] = v // keep array shape (even if length === 1)
        continue
      }
      out[rel] = Array.isArray(v) && v.length === 1 ? v[0] : v
    }
    return out
  }

  /** Build the _links object for a resource (no _embedded here). */
  function buildLinksForResource(
    desc: HypermediaTypes.ResourceDescriptor,
    defs: ResourceDefinition[],
    embeddedPrefixes?: Set<string>,
    opts?: RendererOptions,
  ): { links: Dict; forceArrayRels: Set<string> } {
    const links: Dict = {}
    const def = findDef(defs, desc.class)
    const usedPrefixes = new Set<string>(embeddedPrefixes ?? [])
    const forceArrayRels = new Set<string>()

    const density: 'omit' | 'lean' | 'full' | undefined =
      def?.linkDensity ?? opts?.linkDensity ?? 'full'

    const addLink = (
      rel: string,
      href: string,
      o?: { templated?: boolean; type?: string; title?: string },
    ) => {
      const obj: Dict = {
        href,
        ...(o?.templated ? { templated: true } : {}),
        ...(o?.type ? { type: o.type } : {}),
        ...(o?.title ? { title: o.title } : {}),
      }
      pushLinkShape(links, rel, obj)
      const { prefix } = splitCurie(rel)
      if (prefix) usedPrefixes.add(prefix)
    }

    // self
    if (density !== 'omit' && def?.idTemplate) {
      const href = expand(def.idTemplate, desc.properties, desc.context)
      const type = def?.selfTypeTemplate
        ? expandOptional(def.selfTypeTemplate, desc.properties, desc.context)
        : undefined
      addLink('self', href, { type })
    }

    // collection
    if (density !== 'omit') {
      const ctx = opts?.__collectionContext
      if (ctx?.memberCollectionHref) {
        addLink('collection', ctx.memberCollectionHref)
      } else if (def?.collectionLink) {
        const href = expand(def.collectionLink.href, desc.properties, desc.context)
        addLink(def.collectionLink.rel ?? 'collection', href, {
          templated: def.collectionLink.templated,
        })
      }
    }

    if (density !== 'lean') {
      // extras
      def?.extraLinks?.forEach((l) => {
        const href = expand(l.href, desc.properties, desc.context)
        const type = l.type && expandOptional(l.type, desc.properties, desc.context)
        addLink(l.rel, href, {
          templated: l.templated,
          type,
          title: l.title,
        })
      })

      // parent-configured child collection links
      if (def?.children?.length) {
        for (const child of def.children) {
          const cl = child.collectionLink
          if (!cl) continue
          const rel = getChildRel(null, child.class, child.rel)
          const allowed = cl.resolveTokens ? new Set(cl.resolveTokens) : undefined
          const href = expand(cl.href, desc.properties, desc.context, allowed)
          addLink(rel, href, { templated: cl.templated })
        }
      }
    }

    // CURIEs (always an array; also mark as forced array)
    if (Object.keys(links).length) {
      const curiesBase = def?.curiesBaseHref ?? '/rels/{prefix}/{rel}'
      const curies = [...usedPrefixes].map((name) => ({
        name,
        href: curiesBase.replace('{prefix}', name).replace('{rel}', '{rel}'),
        templated: true,
      }))
      if (curies.length) {
        links.curies = Array.isArray(links.curies) ? links.curies.concat(curies) : curies
        forceArrayRels.add('curies')
      }
    }

    return { links, forceArrayRels }
  }

  function stripQueryExpansion(tpl: string): string {
    // Strip RFC6570 {?...} query expansion suffix
    return tpl.replace(/\{\?[^}]*\}$/, '')
  }
}
