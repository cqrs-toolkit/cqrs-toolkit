/**
 * Cross-collection view types.
 *
 * A view is a named, parameterized query that may join across multiple
 * collections. The library dispatches between two consumer-authored
 * implementations:
 *
 * - **`memory`** — sync closure over an in-memory iterator. Used when the
 *   active storage is `InMemoryStorage` (online-only mode).
 * - **`sql`** — `{ query, transform? }`. `query` returns SQL plus bindings;
 *   the library executes it against the SQLite backend. `transform` (when
 *   present) reshapes each raw SQL row into the public row shape `T`.
 *
 * The library does not provide a SQL builder, JSON-composition helpers, or
 * row mappers beyond the optional `transform`. Consumers write SQL directly
 * and own the cross-mode shape parity between the two implementations.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { JSONPathExpression } from '../../types/json-path.js'
import type { CacheKeyIdentity, CacheKeyTemplate } from '../cache-manager/CacheKey.js'

/**
 * Tight subset of the in-memory storage surface exposed to a view's `memory`
 * closure. Intentionally minimal — one method.
 *
 * Consumers build whatever indexes they need from the iterator (typically a
 * `Map` from FK to record). The library does not pre-bucket data by FK, does
 * not parse / hydrate / re-shape — the closure has full control.
 *
 * `hasLocalChanges` is included per row so the consumer can roll the flag up
 * into the public result if needed. Ignore when irrelevant.
 */
export interface ViewLocalApi {
  iterate<T>(collection: string): Iterable<{ id: string; data: T; hasLocalChanges: boolean }>
}

/**
 * Pagination request — discriminated union to make cursor pagination a peer
 * of offset rather than a string-prefix convention.
 *
 * The library passes `PageRange` to the SQL `query` builder so the user's
 * SQL can inline LIMIT/OFFSET or cursor WHERE predicates. The library never
 * rewrites the user's SQL; pagination clauses are entirely consumer-owned.
 *
 * For the memory path, the library slices the closure's full result at
 * `[offset, offset + limit]` for `kind: 'offset'`. Cursor pagination on the
 * memory path is unsupported in V1 and throws — Mode A is the in-memory
 * escape hatch for small datasets, so cursor pagination there isn't worth
 * the consumer-API surface.
 */
export type PageRange =
  | { kind: 'offset'; limit: number; offset: number }
  | { kind: 'cursor'; limit: number; after?: readonly unknown[] }

/**
 * Result of {@link IQueryManager.getView}.
 *
 * `data` carries the rows in their public shape `T`; `cacheKeys` lists the
 * resolved cache key identities the view declared. `total` is present when
 * the view registration provides a count callback ({@link ViewRegistration.memoryCount}
 * on the memory path; {@link ViewRegistration.sql}.count on the SQL path).
 *
 * The count callback runs independently of the data query — works for
 * `LIMIT/OFFSET`, cursor pagination, or no pagination at all. Consumers
 * that don't need a total simply omit the callbacks.
 */
export interface PagedViewResult<TLink extends Link, T> {
  data: T[]
  cacheKeys: readonly CacheKeyIdentity<TLink>[]
  /**
   * Total row count for the query, independent of the requested page.
   * Populated when the view registration supplies a count callback for the
   * active backend. Undefined when no count callback is configured.
   */
  total?: number
}

/**
 * Registration entry for a cross-collection view.
 *
 * Two type parameters distinguish the SQL row shape (`TRow`) from the public
 * row shape (`T`). When the two coincide (consumer's SQL projects the final
 * shape directly), `T = TRow` collapses the type-system surface to one
 * parameter. When they differ — the common case for joined embeds where
 * SQL projects JSON strings and JS reshapes them into objects — the
 * consumer declares both.
 *
 * Shape parity between `memory`'s output and the post-`transform` SQL output
 * is the consumer's responsibility; the library validates neither.
 */
export interface ViewRegistration<TLink extends Link, TParams, TRow, T = TRow> {
  /** Unique view identifier. */
  name: string

  /**
   * Primary source collection — drives pagination in {@link IQueryManager.watchView}'s
   * page-shift gate. Creates / deletes here may shift page composition.
   */
  primarySource: string

  /**
   * Join-target collections. {@link IQueryManager.watchView} tracks two id
   * sets per join for its row-level gates; in `getView` (pull) the
   * joinSources are advisory and aren't enforced.
   *
   * `referencedIdPath` (required) is the id of the foreign target as it
   * appears on the projected row *after* the join — non-empty only when the
   * target was loaded. Gates on updates / deletes to currently-loaded join
   * targets. Applies to every join shape, including ones where no specific
   * target id is known up front (e.g. "latest note in notebook" — the path
   * resolves to the embedded latest note's id when present).
   *
   * `referencingIdPath` (optional) is the foreign-key-style id the primary
   * row carries to indicate which target it joins to, always present on the
   * projected row when the join is applicable (regardless of whether the
   * target was loaded). Gates on arrivals (`created` / `updated`) of
   * currently-missing join targets — closes the cold-start case. Only
   * applicable to key-based joins where the primary itself carries the id;
   * predicate-based joins (latest-note-in-notebook) leave this undeclared.
   *
   * The projection must preserve the source field on the result row when
   * declaring `referencingIdPath` (e.g., spread the primary row before
   * adding `_embedded`).
   */
  joinSources: readonly {
    collection: string
    referencedIdPath: JSONPathExpression
    referencingIdPath?: JSONPathExpression
  }[]

  /**
   * Returns the cache-key templates the view reads from. The library resolves
   * each template to its {@link CacheKeyIdentity} for inclusion in the result.
   *
   * `createViewQuery` (in `@cqrs-toolkit/client-solid`) holds the resolved
   * identities for the subscription's lifetime — pages don't redeclare or
   * hand-hold them. Standalone `getView` is hold-agnostic; callers that need
   * the underlying data to outlive the read manage holds via the cache
   * manager directly.
   */
  cacheKeys: (params: TParams) => readonly CacheKeyTemplate<TLink>[]

  /**
   * In-memory implementation. Sync; the library does not await per-row work.
   * Called in online-only mode against an `InMemoryStorage`-backed
   * {@link ViewLocalApi}.
   */
  memory: (api: ViewLocalApi, params: TParams) => T[]

  /**
   * Optional total-count callback for the memory path. Runs independently of
   * `memory` so it can use a tighter iteration (skip embed building, skip
   * row construction) when the consumer only needs the count. Library
   * surfaces the return value as {@link PagedViewResult.total}.
   *
   * Independent of pagination kind — works whether `memory` is offset-sliced,
   * cursor-aware, or returns the full set.
   */
  memoryCount?: (api: ViewLocalApi, params: TParams) => number

  /**
   * SQL implementation. `query` returns the raw SQL string and positional
   * bindings; the library executes it verbatim against the active SQLite
   * backend. `transform` (optional) reshapes each result row from the raw
   * SQL projection (`TRow`) to the public row (`T`).
   *
   * When `transform` is absent, `T == TRow` and the library returns SQL
   * rows as-is.
   *
   * `count` (optional) supplies a separate query for the total row count.
   * The library executes it in parallel with `query` and surfaces the first
   * column of the first row as {@link PagedViewResult.total}. Typical shape:
   * `SELECT COUNT(*) FROM rm_<table> WHERE ...`. Independent of `query`'s
   * pagination clause — works for offset, cursor, or no pagination.
   */
  sql: {
    query: (
      params: TParams,
      page: PageRange | undefined,
    ) => {
      sql: string
      bindings: readonly unknown[]
    }
    count?: (params: TParams) => {
      sql: string
      bindings: readonly unknown[]
    }
    transform?: (row: TRow) => T
  }
}

/**
 * Public erased registration shape — what consumers hand to
 * {@link CqrsConfig.views} and to the {@link ViewExecutor} constructor.
 *
 * `TParams` and `TRow` resolve to `never` so any concrete
 * `ViewRegistration<TLink, P, R, T>` assigns without a cast: both appear
 * only in contravariant positions (`TParams` in `cacheKeys(params)`,
 * `memory(api, params)`, `sql.query(params, page)`, `sql.count(params)`;
 * `TRow` in `sql.transform(row)`), and a function that accepts `Specific`
 * trivially satisfies a contract promising only `never` will ever be
 * passed.
 *
 * The library converts each registration into the internal
 * {@link ExecutableView} shape on insert; that conversion is where the
 * unsoundness lives (the executor must pass the caller's actual params
 * and the dispatcher's raw SQL rows to the registered functions).
 */
export type AnyViewRegistration<TLink extends Link> = ViewRegistration<TLink, never, never, unknown>

/**
 * Internal dispatch-time shape — what {@link ViewExecutor} stores and what
 * {@link ViewDispatcher} receives. `TParams` is `unknown` because the
 * executor forwards the caller's runtime params (typed `unknown` at the
 * registry boundary) without knowing the specific shape.
 *
 * The asymmetry with {@link AnyViewRegistration} is deliberate: consumer
 * registration is sound, dispatch is unsound by construction. The library
 * accepts that unsoundness in one named place (the registry insert) so
 * consumer code stays cast-free.
 */
export type ExecutableView<TLink extends Link> = ViewRegistration<
  TLink,
  unknown,
  Record<string, unknown>,
  unknown
>
