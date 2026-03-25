/**
 * Reference-stable query manager decorator.
 *
 * Wraps any IQueryManager and reuses object references for items whose
 * identity (id + updatedAt) has not changed. This allows frameworks that
 * track items by reference (e.g. Solid's `<For>`) to preserve component
 * instances across refetches.
 */

import { type Link, logProvider } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
import {
  catchError,
  distinctUntilChanged,
  filter,
  from,
  map,
  of,
  startWith,
  Subject,
  switchMap,
  takeUntil,
} from 'rxjs'
import type {
  IQueryManager,
  ItemMeta,
  ListQueryResult,
  QueryOptions,
  QueryResult,
} from './types.js'

/**
 * Cached reference entry for a single item.
 */
interface CachedRef {
  ref: unknown
  updatedAt: number
}

/**
 * Decorator around IQueryManager that preserves object references for
 * items whose (id, updatedAt) pair has not changed since the last query.
 */
export class StableRefQueryManager<TLink extends Link> implements IQueryManager<TLink> {
  private readonly inner: IQueryManager<TLink>

  /** Per-collection cache: collection → (id → CachedRef) */
  private readonly refCache = new Map<string, Map<string, CachedRef>>()

  private readonly destroy$ = new Subject<void>()

  constructor(inner: IQueryManager<TLink>) {
    this.inner = inner
  }

  async getById<T>(
    collection: string,
    id: string,
    options?: QueryOptions,
  ): Promise<QueryResult<TLink, T>> {
    const result = await this.inner.getById<T>(collection, id, options)

    if (result.data === undefined || result.meta === undefined) {
      return result
    }

    const collectionCache = this.getOrCreateCollectionCache(collection)
    const reconciled = this.reconcileItem<T>(collectionCache, result.meta, result.data)

    return {
      data: reconciled,
      meta: result.meta,
      hasLocalChanges: result.hasLocalChanges,
      cacheKey: result.cacheKey,
    }
  }

  async getByIds<T>(
    collection: string,
    ids: string[],
    options?: QueryOptions,
  ): Promise<Map<string, QueryResult<TLink, T>>> {
    const results = await this.inner.getByIds<T>(collection, ids, options)
    const collectionCache = this.getOrCreateCollectionCache(collection)

    const reconciled = new Map<string, QueryResult<TLink, T>>()

    for (const [id, result] of results) {
      if (result.data === undefined || result.meta === undefined) {
        reconciled.set(id, result)
        continue
      }

      const stableData = this.reconcileItem<T>(collectionCache, result.meta, result.data)
      reconciled.set(id, {
        data: stableData,
        meta: result.meta,
        hasLocalChanges: result.hasLocalChanges,
        cacheKey: result.cacheKey,
      })
    }

    return reconciled
  }

  async list<T>(collection: string, options?: QueryOptions): Promise<ListQueryResult<TLink, T>> {
    const result = await this.inner.list<T>(collection, options)

    const newCache = new Map<string, CachedRef>()
    const oldCache = this.refCache.get(collection)

    const reconciledData: T[] = []

    for (let i = 0; i < result.data.length; i++) {
      const meta = result.meta[i]
      const data = result.data[i]

      if (meta === undefined || data === undefined) {
        continue
      }

      const existing = oldCache?.get(meta.id)

      if (existing && existing.updatedAt === meta.updatedAt) {
        reconciledData.push(existing.ref as T)
        newCache.set(meta.id, existing)
      } else {
        reconciledData.push(data)
        newCache.set(meta.id, { ref: data, updatedAt: meta.updatedAt })
      }
    }

    // Replace entire collection cache — items not in current result are dropped
    this.refCache.set(collection, newCache)

    return {
      data: reconciledData,
      meta: result.meta,
      total: result.total,
      hasLocalChanges: result.hasLocalChanges,
      cacheKey: result.cacheKey,
    }
  }

  watchCollection(collection: string): Observable<string[]> {
    return this.inner.watchCollection(collection)
  }

  watchById<T>(collection: string, id: string): Observable<T | undefined> {
    // Route through watchCollection filtered to the target ID, then call
    // this.getById (which goes through reconciliation) so the reconciled
    // reference is what distinctUntilChanged sees.
    return this.inner.watchCollection(collection).pipe(
      filter((ids) => ids.includes(id)),
      startWith(undefined),
      switchMap(() =>
        from(this.getById<T>(collection, id)).pipe(
          map((result) => result.data),
          catchError((err) => {
            logProvider.log.error({ err, collection, id }, 'Failed to load value for watchById')
            return of(undefined)
          }),
        ),
      ),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    )
  }

  async exists(collection: string, id: string): Promise<boolean> {
    return this.inner.exists(collection, id)
  }

  async count(collection: string): Promise<number> {
    return this.inner.count(collection)
  }

  async touch(collection: string): Promise<void> {
    return this.inner.touch(collection)
  }

  async hold(cacheKey: string): Promise<void> {
    return this.inner.hold(cacheKey)
  }

  async release(cacheKey: string): Promise<void> {
    return this.inner.release(cacheKey)
  }

  async releaseAll(): Promise<void> {
    return this.inner.releaseAll()
  }

  async destroy(): Promise<void> {
    this.destroy$.next()
    this.destroy$.complete()
    this.refCache.clear()
    await this.inner.destroy()
  }

  /**
   * Reconcile a single item against the collection cache.
   * Returns the cached reference if (id, updatedAt) matches, otherwise caches the new reference.
   */
  private reconcileItem<T>(collectionCache: Map<string, CachedRef>, meta: ItemMeta, data: T): T {
    const existing = collectionCache.get(meta.id)

    if (existing && existing.updatedAt === meta.updatedAt) {
      return existing.ref as T
    }

    collectionCache.set(meta.id, { ref: data, updatedAt: meta.updatedAt })
    return data
  }

  private getOrCreateCollectionCache(collection: string): Map<string, CachedRef> {
    let cache = this.refCache.get(collection)
    if (!cache) {
      cache = new Map()
      this.refCache.set(collection, cache)
    }
    return cache
  }
}
