/**
 * SolidJS reactive primitives for EntityId-aware cache key registration.
 *
 * These primitives use the CqrsClient from context to register cache keys
 * and automatically update when IDs are reconciled (client → server).
 */

import type {
  CacheKeyIdentity,
  CacheKeyTemplate,
  EntityCacheKey,
  EntityCacheKeyTemplate,
  EntityId,
  ICacheManager,
  LibraryEvent,
  ScopeCacheKey,
  ScopeCacheKeyTemplate,
} from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { concat, filter, map, type Observable, of, from as rxFrom, switchMap } from 'rxjs'
import { observable, from as solidFrom } from 'solid-js'
import { useClient } from './context.js'

/**
 * Create a reactive entity cache key that registers with the CacheManager.
 *
 * Uses the CqrsClient from context. Returns `undefined` when the id accessor
 * returns `undefined`. Automatically updates when IDs are reconciled.
 *
 * @param linkTemplate - Link fields without `id` (e.g., `{ service: 'nb', type: 'Notebook' }`)
 * @param id - Reactive accessor returning the entity ID or undefined
 * @param parentKey - Optional parent cache key for hierarchical eviction
 * @returns Accessor returning the registered entity cache key, or undefined
 */
export function createEntityCacheKey<TLink extends Link>(
  linkTemplate: Omit<TLink, 'id'>,
  id: () => EntityId | undefined,
  parentKey?: string,
): () => EntityCacheKey<TLink> | undefined {
  const client = useClient<TLink>()

  const template$ = rxFrom(
    observable((): EntityCacheKeyTemplate<TLink> | undefined => {
      const currentId = id()
      if (!currentId) return undefined
      return {
        kind: 'entity',
        // Cast: TLink extends Link (id: string) but EntityRef may be in id for template scanning
        link: { ...linkTemplate, id: currentId } as unknown as TLink,
        parentKey,
      }
    }),
  )

  return solidFrom<EntityCacheKey<TLink> | undefined>(
    cacheKeyIdentity$(client.cacheManager, client.events$, template$),
  )
}

/**
 * Scope cache key options for the reactive primitive.
 */
interface ScopeCacheKeyOptions {
  service?: string
  scopeType: string
  scopeParams?: () => Record<string, unknown> | undefined
  parentKey?: string
  entityRefPaths?: string[]
}

/**
 * Create a reactive scope cache key that registers with the CacheManager.
 *
 * Uses the CqrsClient from context. Always goes through `registerCacheKey`
 * for stable opaque UUIDs. Automatically updates when IDs are reconciled.
 *
 * `entityRefPaths` is only needed for nested EntityRef values in `scopeParams`.
 * Top-level EntityRef values in `scopeParams` are detected automatically.
 *
 * Returns `undefined` when `scopeParams` returns `undefined`.
 */
export function createScopeCacheKey<TLink extends Link>(
  options: ScopeCacheKeyOptions,
): () => ScopeCacheKey | undefined {
  const client = useClient<TLink>()

  const template$ = rxFrom(
    observable((): ScopeCacheKeyTemplate | undefined => {
      const params = options.scopeParams?.()
      if (options.scopeParams && typeof params === 'undefined') return undefined
      return {
        kind: 'scope',
        service: options.service,
        scopeType: options.scopeType,
        scopeParams: params,
        parentKey: options.parentKey,
        entityRefPaths: options.entityRefPaths,
      }
    }),
  )

  return solidFrom<ScopeCacheKey | undefined>(
    cacheKeyIdentity$(client.cacheManager, client.events$, template$),
  )
}

/**
 * Create an observable that emits the registered cache key identity,
 * then emits updated identities when the key is reconciled.
 *
 * Pure rxjs — no Solid dependency. Testable in isolation.
 *
 * @param cacheManager - CacheManager to register with
 * @param events$ - Library event stream for reconciliation events
 * @param template$ - Cache key template stream to register
 * @returns Observable of cache key identities
 */
export function cacheKeyIdentity$<TLink extends Link>(
  cacheManager: ICacheManager<TLink>,
  events$: Observable<LibraryEvent<TLink>>,
  template$: Observable<EntityCacheKeyTemplate<TLink> | undefined>,
): Observable<EntityCacheKey<TLink> | undefined>
export function cacheKeyIdentity$<TLink extends Link>(
  cacheManager: ICacheManager<TLink>,
  events$: Observable<LibraryEvent<TLink>>,
  template$: Observable<ScopeCacheKeyTemplate | undefined>,
): Observable<ScopeCacheKey | undefined>
export function cacheKeyIdentity$<TLink extends Link>(
  cacheManager: ICacheManager<TLink>,
  events$: Observable<LibraryEvent<TLink>>,
  template$: Observable<CacheKeyTemplate<TLink> | undefined>,
): Observable<CacheKeyIdentity<TLink> | undefined>
export function cacheKeyIdentity$<TLink extends Link>(
  cacheManager: ICacheManager<TLink>,
  events$: Observable<LibraryEvent<TLink>>,
  template$: Observable<CacheKeyTemplate<TLink> | undefined>,
): Observable<CacheKeyIdentity<TLink> | undefined> {
  return template$.pipe(
    switchMap((template) => {
      if (!template) return of(undefined)

      return rxFrom(cacheManager.registerCacheKey(template)).pipe(
        switchMap((identity) =>
          concat(
            of(identity),
            events$.pipe(
              filter(
                (e): e is LibraryEvent<TLink, 'cache:key-reconciled'> =>
                  isKeyReconciled(e) && e.data.cacheKey.key === identity.key,
              ),
              map((e) => e.data.cacheKey),
            ),
          ),
        ),
      )
    }),
  )
}

function isKeyReconciled<TLink extends Link>(
  e: LibraryEvent<TLink>,
): e is LibraryEvent<TLink, 'cache:key-reconciled'> {
  return e.type === 'cache:key-reconciled'
}
