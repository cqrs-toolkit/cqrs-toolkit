/**
 * React hooks for EntityId-aware cache key registration.
 *
 * These hooks use the CqrsClient from context to register cache keys and
 * automatically update when IDs are reconciled (client → server).
 *
 * Lifetime discipline — see
 * `docs/projects/client-react/explorations/observable-lifetime-across-rerenders.md`.
 * A single rxjs subscription is set up in a mount-only useEffect. A
 * BehaviorSubject in a ref feeds new template values into the pipeline as
 * inputs change, so the registration / reconciliation pipeline survives
 * re-renders. The snapshot is exposed via useSyncExternalStore.
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
import { useEffect, useRef, useSyncExternalStore } from 'react'
import {
  BehaviorSubject,
  concat,
  filter,
  map,
  type Observable,
  of,
  from as rxFrom,
  switchMap,
} from 'rxjs'
import { useClient } from './context.js'

/**
 * Subscribe to the cache key for an entity, returning the registered identity.
 *
 * Returns `undefined` while `id` is `undefined` or before the initial
 * registration resolves. Automatically updates when IDs are reconciled
 * (client temp ID → server ID).
 *
 * @param linkTemplate - Link fields without `id` (e.g., `{ service: 'nb', type: 'Notebook' }`)
 * @param id - Entity ID, or `undefined` to disable registration
 * @param parentKey - Optional parent cache key for hierarchical eviction
 */
export function useEntityCacheKey<TLink extends Link>(
  linkTemplate: Omit<TLink, 'id'>,
  id: EntityId | undefined,
  parentKey?: string,
): EntityCacheKey<TLink> | undefined {
  const client = useClient<TLink>()

  const template = buildEntityTemplate(linkTemplate, id, parentKey)

  return useTemplateSubscription<EntityCacheKeyTemplate<TLink>, EntityCacheKey<TLink>>(
    template,
    (subject) => cacheKeyIdentity$(client.cacheManager, client.events$, subject),
  )
}

function buildEntityTemplate<TLink extends Link>(
  linkTemplate: Omit<TLink, 'id'>,
  id: EntityId | undefined,
  parentKey: string | undefined,
): EntityCacheKeyTemplate<TLink> | undefined {
  if (!id) return undefined
  return {
    kind: 'entity',
    // Cast: TLink extends Link (id: string) but EntityRef may appear in id
    // for template scanning. Mirrors the client-solid implementation.
    link: { ...linkTemplate, id } as unknown as TLink,
    parentKey,
  }
}

/**
 * Scope cache key options for the React hook.
 */
interface ScopeCacheKeyOptions {
  service?: string
  scopeType: string
  scopeParams?: Record<string, unknown> | undefined
  parentKey?: string
  entityRefPaths?: string[]
}

/**
 * Subscribe to a scope cache key, returning the registered identity.
 *
 * Always goes through `registerCacheKey` for stable opaque UUIDs.
 * Automatically updates when IDs are reconciled.
 *
 * `entityRefPaths` is only needed for nested EntityRef values in `scopeParams`.
 * Top-level EntityRef values in `scopeParams` are detected automatically.
 *
 * Returns `undefined` when `scopeParams` is `undefined` (and the caller passed
 * `scopeParams` as a key — explicit opt-in to inactive state).
 */
export function useScopeCacheKey<TLink extends Link>(
  options: ScopeCacheKeyOptions,
): ScopeCacheKey | undefined {
  const client = useClient<TLink>()

  const template = buildScopeTemplate(options)

  return useTemplateSubscription<ScopeCacheKeyTemplate, ScopeCacheKey>(template, (subject) =>
    cacheKeyIdentity$(client.cacheManager, client.events$, subject),
  )
}

function buildScopeTemplate(options: ScopeCacheKeyOptions): ScopeCacheKeyTemplate | undefined {
  // Mirror client-solid: the consumer "opts into inactive" by passing
  // `scopeParams` with an undefined value. The presence of the key matters,
  // not just the value.
  if ('scopeParams' in options && typeof options.scopeParams === 'undefined') return undefined
  return {
    kind: 'scope',
    service: options.service,
    scopeType: options.scopeType,
    scopeParams: options.scopeParams,
    parentKey: options.parentKey,
    entityRefPaths: options.entityRefPaths,
  }
}

/**
 * Bind a single template-input → identity pipeline to a hook's lifecycle.
 *
 * - The BehaviorSubject lives in a ref so it survives re-renders.
 * - The pipeline subscription is set up exactly once (mount-only useEffect)
 *   and torn down only on unmount. Re-renders push new templates into the
 *   subject; the pipeline reacts internally without re-subscription.
 * - Snapshot is surfaced via useSyncExternalStore.
 *
 * The `templatesEqual` shallow check is what keeps the pipeline from
 * re-registering on every render when the caller passes a freshly-constructed
 * but value-equivalent template object.
 */
function useTemplateSubscription<TTemplate, TIdentity>(
  template: TTemplate | undefined,
  buildPipeline: (
    subject: BehaviorSubject<TTemplate | undefined>,
  ) => Observable<TIdentity | undefined>,
): TIdentity | undefined {
  const subjectRef = useRef<BehaviorSubject<TTemplate | undefined> | null>(null)
  if (subjectRef.current === null) {
    subjectRef.current = new BehaviorSubject<TTemplate | undefined>(template)
  }
  const subject = subjectRef.current

  const snapshotRef = useRef<{ value: TIdentity | undefined }>({ value: undefined })
  const listenersRef = useRef<Set<() => void>>(new Set())

  // Stable subscribe / getSnapshot for useSyncExternalStore.
  const apiRef = useRef<{
    subscribe: (cb: () => void) => () => void
    getSnapshot: () => TIdentity | undefined
  } | null>(null)
  if (apiRef.current === null) {
    apiRef.current = {
      subscribe: (cb: () => void): (() => void) => {
        listenersRef.current.add(cb)
        return () => {
          listenersRef.current.delete(cb)
        }
      },
      getSnapshot: () => snapshotRef.current.value,
    }
  }

  // Mount-only pipeline setup. Cleanup is the only place the subscription
  // is disposed — render-side changes flow through `subject.next(...)`.
  useEffect(() => {
    const subscription = buildPipeline(subject).subscribe((value) => {
      snapshotRef.current = { value }
      for (const listener of listenersRef.current) listener()
    })
    return () => {
      subscription.unsubscribe()
    }
    // The pipeline factory and subject are stable for the hook's lifetime;
    // intentionally a mount-only effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push new template into the subject when inputs change. Shallow-equal
  // templates are skipped so consumers passing fresh literals each render
  // don't trigger redundant re-registrations.
  const lastPushedRef = useRef<TTemplate | undefined>(template)
  const firstRunRef = useRef(true)
  useEffect(() => {
    if (firstRunRef.current) {
      // The initial template was already seeded into the BehaviorSubject by
      // the ref initializer above; skip the first effect run so we don't
      // re-emit the same value.
      firstRunRef.current = false
      lastPushedRef.current = template
      return
    }
    if (templatesEqual(lastPushedRef.current, template)) return
    lastPushedRef.current = template
    subject.next(template)
  }, [template, subject])

  return useSyncExternalStore(apiRef.current.subscribe, apiRef.current.getSnapshot)
}

function templatesEqual<T>(a: T | undefined, b: T | undefined): boolean {
  if (Object.is(a, b)) return true
  if (a === undefined || b === undefined) return false
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const aRec = a as Record<string, unknown>
  const bRec = b as Record<string, unknown>
  const aKeys = Object.keys(aRec)
  const bKeys = Object.keys(bRec)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (!Object.is(aRec[k], bRec[k])) {
      // Nested objects (e.g. `link` on an entity template) — one level deep.
      const av = aRec[k]
      const bv = bRec[k]
      if (
        typeof av === 'object' &&
        typeof bv === 'object' &&
        av !== null &&
        bv !== null &&
        !shallowEqual(av as Record<string, unknown>, bv as Record<string, unknown>)
      ) {
        return false
      }
      if (typeof av !== 'object' || typeof bv !== 'object' || av === null || bv === null) {
        return false
      }
    }
  }
  return true
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (Object.is(a, b)) return true
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (!Object.is(a[k], b[k])) return false
  }
  return true
}

/**
 * Pure rxjs pipeline: registers a cache-key template, emits the registered
 * identity, then emits updated identities when the key is reconciled.
 *
 * Mirrors the helper in `client-solid` — kept in this package so the
 * `@cqrs-toolkit/client` public API surface stays unchanged.
 *
 * @internal Exported for test use only.
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
