/**
 * Integration tests for {@link createScopeCacheKey} and {@link createEntityCacheKey}.
 *
 * Wires the SolidJS primitives against a real {@link CqrsClient} using the
 * shared bootstrappers from `@cqrs-toolkit/client/testing`. Runs under both
 * the in-memory and SQLite-backed wiring paths via `describe.each`.
 */

import {
  bootstrapVariants,
  integrationTestOptions,
  todoCreatedProcessor,
  type TodoRow,
} from '@cqrs-toolkit/client/testing'
import { type ServiceLink } from '@meticoeus/ddd-es'
import { createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { createEntityCacheKey, createScopeCacheKey } from './createCacheKey.js'
import { createRun, tick, todosCollection } from './testing/index.js'

describe.each(bootstrapVariants)('$name createScopeCacheKey (integration)', ({ bootstrap }) => {
  const run = createRun(bootstrap)

  it(
    'registers a scope key that the cache manager recognises structurally',
    integrationTestOptions,
    run(
      {
        collections: [todosCollection()],
        processors: [todoCreatedProcessor()],
      },
      async (ctx) => {
        const cacheKeyAccessor = createScopeCacheKey<ServiceLink>({ scopeType: 'todos' })
        await tick()

        const identity = cacheKeyAccessor()
        expect(identity).toBeDefined()
        if (!identity) return
        expect(identity.kind).toBe('scope')
        expect(identity.scopeType).toBe('todos')
        expect(typeof identity.key).toBe('string')

        // Re-registering the same template returns the same opaque UUID —
        // proves the Solid primitive is wired into the live registry.
        const sameRegistration = await ctx.client.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'todos',
        })
        expect(sameRegistration.key).toBe(identity.key)
      },
    ),
  )

  it(
    're-registers when scopeParams accessor toggles defined/undefined',
    integrationTestOptions,
    run({ collections: [todosCollection()] }, async () => {
      const [params, setParams] = createSignal<Record<string, unknown> | undefined>(undefined)
      const cacheKeyAccessor = createScopeCacheKey<ServiceLink>({
        scopeType: 'todos',
        scopeParams: params,
      })
      await tick()
      expect(cacheKeyAccessor()).toBeUndefined()

      setParams({ done: true })
      await tick()
      const resolved = cacheKeyAccessor()
      expect(resolved).toBeDefined()
      if (!resolved) return
      expect(resolved.scopeType).toBe('todos')
      expect(resolved.scopeParams).toEqual({ done: true })
    }),
  )

  it(
    'lets callers query existing data using the registered key',
    integrationTestOptions,
    run(
      {
        collections: [todosCollection()],
        processors: [todoCreatedProcessor()],
      },
      async (ctx) => {
        // Pre-register the same template outside Solid, then seed under that key.
        // The Solid primitive will resolve to the same identity via the registry's
        // structural lookup — this is the contract that integration consumers rely on.
        const registered = await ctx.client.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'todos',
        })
        await ctx.readModelStore.setServerData(
          'todos',
          'seeded-1',
          { id: 'seeded-1', title: 'Seeded' },
          registered.key,
        )

        // After awaits we've lost the synchronous Solid owner — re-enter
        // it via runInOwner so the primitive's useClient() call resolves.
        const cacheKeyAccessor = ctx.runInOwner(() =>
          createScopeCacheKey<ServiceLink>({ scopeType: 'todos' }),
        )
        await tick()
        const identity = cacheKeyAccessor()
        expect(identity).toBeDefined()
        if (!identity) return
        expect(identity.key).toBe(registered.key)

        const list = await ctx.client.queryManager.list<TodoRow>({
          collection: 'todos',
          cacheKey: identity,
        })
        expect(list.data).toHaveLength(1)
        expect(list.data[0]?.title).toBe('Seeded')
      },
    ),
  )
})

describe.each(bootstrapVariants)('$name createEntityCacheKey (integration)', ({ bootstrap }) => {
  const run = createRun(bootstrap)

  it(
    'returns undefined while the id accessor returns undefined',
    integrationTestOptions,
    run({ collections: [todosCollection()] }, async () => {
      const [id, setId] = createSignal<string | undefined>(undefined)
      const cacheKeyAccessor = createEntityCacheKey<ServiceLink>(
        { service: 'nb', type: 'Todo' },
        id,
      )
      await tick()
      expect(cacheKeyAccessor()).toBeUndefined()

      setId('todo-static')
      await tick()
      const identity = cacheKeyAccessor()
      expect(identity).toBeDefined()
      if (!identity) return
      expect(identity.kind).toBe('entity')
      expect(identity.link.id).toBe('todo-static')
      expect(identity.link.service).toBe('nb')
      expect(identity.link.type).toBe('Todo')
    }),
  )

  it(
    'registers a stable entity key resolvable through the registry',
    integrationTestOptions,
    run({ collections: [todosCollection()] }, async (ctx) => {
      const cacheKeyAccessor = createEntityCacheKey<ServiceLink>(
        { service: 'nb', type: 'Todo' },
        () => 'todo-1',
      )
      await tick()
      const identity = cacheKeyAccessor()
      expect(identity).toBeDefined()
      if (!identity) return

      const sameRegistration = await ctx.client.cacheManager.registerCacheKey({
        kind: 'entity',
        link: { service: 'nb', type: 'Todo', id: 'todo-1' } as ServiceLink,
      })
      expect(sameRegistration.key).toBe(identity.key)
    }),
  )
})
