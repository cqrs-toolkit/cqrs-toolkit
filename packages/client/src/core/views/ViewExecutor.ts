/**
 * View executor — dispatches a view registration to either its memory or
 * its SQL implementation based on the active storage backend.
 *
 * Constructed once per process with a mode-specific {@link ViewDispatcher}.
 * The dispatcher closes over the resources each mode needs (`ViewLocalApi`
 * for in-memory, an SQL runner for SQLite-backed storage) so the executor
 * itself stays mode-agnostic.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { ISqliteDb } from '../../storage/ISqliteDb.js'
import { validatePath } from '../entity-ref/ref-path.js'
import type { AnyViewRegistration, ExecutableView, PageRange, ViewLocalApi } from './types.js'

/**
 * Result of a view dispatch — public rows plus an optional total row count
 * (populated when the view registration supplies a count callback for the
 * active backend).
 */
export interface ViewDispatchResult {
  rows: unknown[]
  total?: number
}

/**
 * Runs a view's selected implementation, returning the array of public
 * rows (post-`transform` for SQL views) and an optional total. Library
 * callers receive a type-erased result and cast.
 */
export type ViewDispatcher<TLink extends Link> = (
  view: ExecutableView<TLink>,
  params: unknown,
  page: PageRange | undefined,
) => Promise<ViewDispatchResult>

/**
 * In-memory dispatcher. Calls the view's `memory` closure against the given
 * {@link ViewLocalApi} and slices for offset-pagination if the consumer
 * supplied a `kind: 'offset'` page. If `memoryCount` is configured, runs
 * it after `memory` to populate `total`.
 *
 * Cursor pagination on the memory path is unsupported and throws — Mode A
 * is the in-memory escape hatch for small datasets; cursor pagination there
 * isn't worth the surface.
 */
export function createInMemoryDispatcher<TLink extends Link>(
  api: ViewLocalApi,
): ViewDispatcher<TLink> {
  return async (view, params, page) => {
    if (page && page.kind === 'cursor') {
      throw new Error(
        `View '${view.name}': cursor pagination is not supported on the in-memory dispatcher; use 'kind: \\'offset\\'' or run against the SQL backend`,
      )
    }
    const full = view.memory(api, params)
    const rows = page ? full.slice(page.offset, page.offset + page.limit) : full
    const total = view.memoryCount ? view.memoryCount(api, params) : undefined
    return { rows, total }
  }
}

/**
 * SQL dispatcher. Runs the view's `sql.query(...)` against the SQLite
 * backend, applies `sql.transform` per row if present, otherwise returns
 * rows verbatim. If `sql.count` is configured, runs it in parallel with
 * the data query; the first column of the first row of the count result
 * is surfaced as `total`.
 */
export function createSqlDispatcher<TLink extends Link>(db: ISqliteDb): ViewDispatcher<TLink> {
  return async (view, params, page) => {
    const data = view.sql.query(params, page)
    const countQuery = view.sql.count?.(params)

    const [rawRows, countRows] = await Promise.all([
      db.exec<Record<string, unknown>>(data.sql, {
        bind: data.bindings as unknown[],
        rowMode: 'object',
        returnValue: 'resultRows',
      }),
      countQuery
        ? db.exec<Record<string, unknown>>(countQuery.sql, {
            bind: countQuery.bindings as unknown[],
            rowMode: 'object',
            returnValue: 'resultRows',
          })
        : Promise.resolve(undefined),
    ])

    const transform = view.sql.transform
    const rows = transform ? rawRows.map((row) => transform(row)) : rawRows

    let total: number | undefined
    if (countRows && countRows.length > 0) {
      // Convention: the count query returns a single row with a single
      // column. The column name is irrelevant — we read the first value.
      const firstRow = countRows[0] as Record<string, unknown>
      const values = Object.values(firstRow)
      const raw = values[0]
      if (typeof raw === 'number') total = raw
      else if (typeof raw === 'bigint') total = Number(raw)
      else if (typeof raw === 'string') total = Number(raw)
    }

    return { rows, total }
  }
}

/**
 * Registry + dispatch entry point for views. The library constructs one of
 * these per process; QueryManager holds a reference and delegates
 * `getView` calls.
 */
export class ViewExecutor<TLink extends Link> {
  private readonly registry: ReadonlyMap<string, ExecutableView<TLink>>

  constructor(
    views: readonly AnyViewRegistration<TLink>[],
    private readonly dispatch: ViewDispatcher<TLink>,
  ) {
    const map = new Map<string, ExecutableView<TLink>>()
    for (const view of views) {
      if (map.has(view.name)) {
        throw new Error(`Duplicate view registration: '${view.name}'`)
      }
      for (const join of view.joinSources) {
        try {
          validatePath(join.referencedIdPath)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          throw new Error(
            `Invalid referencedIdPath on view '${view.name}' joinSource for collection '${join.collection}': ${message}`,
          )
        }
        if (join.referencingIdPath !== undefined) {
          try {
            validatePath(join.referencingIdPath)
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            throw new Error(
              `Invalid referencingIdPath on view '${view.name}' joinSource for collection '${join.collection}': ${message}`,
            )
          }
        }
      }
      // The registration's `TParams` is contravariantly `never`; the
      // executor needs `unknown` so it can forward the caller's runtime
      // params. This is the one place the library accepts that
      // unsoundness — see {@link AnyViewRegistration} / {@link ExecutableView}.
      map.set(view.name, view as unknown as ExecutableView<TLink>)
    }
    this.registry = map
  }

  /** Look up a view by name. Returns undefined when unknown. */
  get(name: string): ExecutableView<TLink> | undefined {
    return this.registry.get(name)
  }

  /**
   * Execute a view by name with params + page. Throws when the name is
   * unknown. Returns rows + optional total — total is populated only when
   * the view registration supplies a count callback for the active backend.
   */
  async execute(
    name: string,
    params: unknown,
    page: PageRange | undefined,
  ): Promise<ViewDispatchResult> {
    const view = this.registry.get(name)
    if (!view) {
      throw new Error(`Unknown view: '${name}'`)
    }
    return this.dispatch(view, params, page)
  }
}
