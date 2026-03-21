import { HAL } from '../hal.js'
import type { CursorPagination, EventCursorPagination, Querystring } from '../shared-types.js'
import type { HypermediaTypes } from '../types.js'

export namespace Hypermedia {
  const MT_HAL = 'application/hal+json'

  function wantsHAL(acceptHeader?: string | string[]): boolean {
    const raw = Array.isArray(acceptHeader) ? acceptHeader.join(', ') : acceptHeader
    const a = (raw || '').toLowerCase()
    if (!a || a.includes('*/*')) return true
    return a.includes(MT_HAL)
  }

  function buildUrl(path: string, query: Querystring): string {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query || {})) {
      if (v === undefined || v === null) continue
      if (Array.isArray(v)) {
        for (const each of v) {
          if (each === undefined || each === null) continue
          params.append(k, String(each))
        }
      } else {
        params.append(k, String(v))
      }
    }
    const qs = params.toString()
    return qs ? `${path}?${qs}` : path
  }

  /**
   * Builds a {@link HypermediaTypes.CollectionDescriptor} from a
   * {@link CursorPagination.Connection} and a {@link HypermediaTypes.PageView}.
   *
   * This is the single canonical place where connection-level metadata is mapped
   * into the collection descriptor (e.g. `total`, `counts`, and future connection features).
   * Centralizing this prevents call sites from forgetting to propagate metadata.
   *
   * @template T - Entity payload type contained in `connection.entities`.
   * @template Counts - Optional per-entity counts metadata copied to the descriptor when present.
   *
   * @param params
   * @param params.connection - Cursor pagination connection containing entities and optional metadata.
   * @param params.page - Hypermedia page/view links (self/first/prev/next/last).
   * @param params.buildMember - Maps each entity into a {@link HypermediaTypes.ResourceDescriptor}.
   * @param params.context - Optional context to resolve templated parameters in collection links.
   *
   * @returns A {@link HypermediaTypes.CollectionDescriptor} containing page metadata, members,
   * and any supported connection metadata (e.g. `counts`).
   */
  export function buildCollectionDescriptor<
    T extends object = any,
    Counts extends object = Record<string, any>,
  >(params: {
    connection: CursorPagination.Connection<T, Counts>
    page: HypermediaTypes.PageView
    buildMember: (data: T, idx: number) => HypermediaTypes.ResourceDescriptor
    context?: Record<string, any>
  }) {
    const { connection } = params
    const cd: HypermediaTypes.CollectionDescriptor<T, Counts> = {
      page: params.page,
      members: connection.entities.map(params.buildMember),
      context: params.context,
    }

    if (typeof connection.total === 'number') cd.totalItems = connection.total
    if (connection.counts) cd.counts = connection.counts

    return cd
  }

  export function pageViewFromCursor<
    T extends object = any,
    Counts extends object = Record<string, any>,
  >(
    connection: CursorPagination.Connection<T, Counts>,
    opts: {
      path: string
      query: Querystring
    },
  ): HypermediaTypes.PageView {
    const query = opts.query ?? {}
    // self is current request (leave cursor as-is if present)
    const self = buildUrl(opts.path, query)

    // first is the same query with cursor removed
    const { cursor: _omit, ...baseQuery } = query
    const first = buildUrl(opts.path, baseQuery)

    const prev = connection.prevCursor
      ? buildUrl(opts.path, { ...baseQuery, cursor: connection.prevCursor })
      : undefined

    const next = connection.nextCursor
      ? buildUrl(opts.path, { ...baseQuery, cursor: connection.nextCursor })
      : undefined

    const pv: HypermediaTypes.PageView = { self, first }
    if (prev) pv.prev = prev
    if (next) pv.next = next
    return pv
  }

  export function eventPageViewFromCursor<T = any>(
    connection: EventCursorPagination.Connection<T>,
    opts: {
      path: string
      query: Querystring
      /** If true, use afterRevision; otherwise use afterPosition */
      revision?: boolean
    },
  ): HypermediaTypes.PageView {
    const query = opts.query ?? {}

    // self is the current request as-is (preserve any existing after* params)
    const self = buildUrl(opts.path, query)

    // baseQuery removes any paging hints to build 'first' & as a base for 'next'
    const {
      cursor: _omitCursor,
      afterRevision: _omitAfterRev,
      afterPosition: _omitAfterPos,
      ...baseQuery
    } = query

    const first = buildUrl(opts.path, baseQuery)

    // only support NEXT; use event keyset param name
    let next: string | undefined
    if (connection.nextCursor) {
      const afterKey = opts.revision ? 'afterRevision' : 'afterPosition'
      next = buildUrl(opts.path, {
        ...baseQuery,
        [afterKey]: connection.nextCursor,
      } as Querystring)
    }

    const pv: HypermediaTypes.PageView = { self, first }
    if (next) pv.next = next
    return pv
  }

  export interface ResourceFormatConfig {
    halDefs: HAL.ResourceDefinition[]
    /** Optional link density mode for item rendering (HAL only). */
    linkDensity?: 'omit' | 'lean' | 'full'
  }

  export interface CollectionFormatConfig extends ResourceFormatConfig {
    collectionDef: HAL.CollectionDefinition
    /** Optional link density mode for item rendering (HAL only). */
    linkDensity?: HAL.RendererOptions['linkDensity']
  }

  export interface Request {
    headers: Record<string, string | string[] | undefined>
    query?: Querystring
  }

  export function formatResource<T extends object>(
    req: Request,
    desc: HypermediaTypes.ResourceDescriptor<T>,
    cfg: ResourceFormatConfig,
  ) {
    if (wantsHAL(req.headers.accept)) {
      return {
        contentType: MT_HAL,
        body: HAL.fromResource(desc, cfg.halDefs, { linkDensity: cfg.linkDensity }),
      }
    }
    return { contentType: 'application/json', body: desc.properties }
  }

  export function formatCollection<T extends object, Counts extends object = Record<string, any>>(
    req: Request,
    desc: HypermediaTypes.CollectionDescriptor<T, Counts>,
    cfg: CollectionFormatConfig,
  ) {
    if (wantsHAL(req.headers.accept)) {
      return {
        contentType: MT_HAL,
        body: HAL.fromCollection(desc, cfg.halDefs, cfg.collectionDef, {
          linkDensity: cfg.linkDensity,
        }),
      }
    }
    // fallback
    return {
      contentType: 'application/json',
      body: {
        entities: desc.members.map((m) => (m as any).properties ?? m),
        nextCursor: extractCursor(desc.page?.next),
        totalItems: desc.totalItems,
        _counts: desc.counts,
      },
    }
  }

  // helper to pull `cursor` from a next link if you want to preserve old shape:
  function extractCursor(nextUrl?: string) {
    if (!nextUrl) return null
    try {
      const u = new URL(nextUrl, 'http://x') // base for relative URLs
      return u.searchParams.get('cursor')
    } catch {
      return null
    }
  }
}
