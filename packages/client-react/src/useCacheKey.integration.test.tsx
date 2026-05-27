/**
 * Integration tests for {@link useScopeCacheKey} and {@link useEntityCacheKey}.
 *
 * Wires the React hooks against a real {@link CqrsClient} using the shared
 * bootstrappers from `@cqrs-toolkit/client/testing`. Runs under both the
 * in-memory and SQLite-backed wiring paths via `describe.each`.
 */

import {
  bootstrapVariants,
  integrationTestOptions,
  todoCreatedProcessor,
  type TodoRow,
} from '@cqrs-toolkit/client/testing'
import { type ServiceLink } from '@meticoeus/ddd-es'
import { act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createRun, tick, todosCollection } from './testing/index.js'
import { useEntityCacheKey, useScopeCacheKey } from './useCacheKey.js'

describe.each(bootstrapVariants)('$name useScopeCacheKey (integration)', ({ bootstrap }) => {
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
        const { result } = ctx.renderHook(() =>
          useScopeCacheKey<ServiceLink>({ scopeType: 'todos' }),
        )
        await act(async () => {
          await tick()
        })

        const identity = result.current
        expect(identity).toBeDefined()
        if (!identity) return
        expect(identity.kind).toBe('scope')
        expect(identity.scopeType).toBe('todos')
        expect(typeof identity.key).toBe('string')

        // Re-registering the same template returns the same opaque UUID —
        // proves the hook is wired into the live registry.
        const sameRegistration = await ctx.client.cacheManager.registerCacheKey({
          kind: 'scope',
          scopeType: 'todos',
        })
        expect(sameRegistration.key).toBe(identity.key)
      },
    ),
  )

  it(
    're-registers when scopeParams toggles defined/undefined',
    integrationTestOptions,
    run({ collections: [todosCollection()] }, async (ctx) => {
      interface Props {
        scopeParams: Record<string, unknown> | undefined
      }
      const initialProps: Props = { scopeParams: undefined }
      const { result, rerender } = ctx.renderHook(
        (_props: Props) =>
          useScopeCacheKey<ServiceLink>({
            scopeType: 'todos',
            scopeParams: _props.scopeParams,
          }),
        initialProps,
      )
      await act(async () => {
        await tick()
      })
      expect(result.current).toBeUndefined()

      await act(async () => {
        rerender({ scopeParams: { done: true } })
        await tick()
      })
      const resolved = result.current
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
        // Pre-register the same template outside React, then seed under it.
        // The hook will resolve to the same identity via the registry's
        // structural lookup — the contract integration consumers rely on.
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

        const { result } = ctx.renderHook(() =>
          useScopeCacheKey<ServiceLink>({ scopeType: 'todos' }),
        )
        await act(async () => {
          await tick()
        })
        const identity = result.current
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

describe.each(bootstrapVariants)('$name useEntityCacheKey (integration)', ({ bootstrap }) => {
  const run = createRun(bootstrap)

  it(
    'returns undefined while the id is undefined',
    integrationTestOptions,
    run({ collections: [todosCollection()] }, async (ctx) => {
      interface Props {
        id: string | undefined
      }
      const initialProps: Props = { id: undefined }
      const { result, rerender } = ctx.renderHook(
        (props: Props) => useEntityCacheKey<ServiceLink>({ service: 'nb', type: 'Todo' }, props.id),
        initialProps,
      )
      await act(async () => {
        await tick()
      })
      expect(result.current).toBeUndefined()

      await act(async () => {
        rerender({ id: 'todo-static' })
        await tick()
      })
      const identity = result.current
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
      const { result } = ctx.renderHook(() =>
        useEntityCacheKey<ServiceLink>({ service: 'nb', type: 'Todo' }, 'todo-1'),
      )
      await act(async () => {
        await tick()
      })
      const identity = result.current
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
