import type {
  CacheKeyTemplate,
  EntityCacheKey,
  EntityCacheKeyTemplate,
  ICacheManager,
  LibraryEvent,
} from '@cqrs-toolkit/client'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { EMPTY, firstValueFrom, of, Subject, take, toArray } from 'rxjs'
import { describe, expect, it, vi } from 'vitest'
import { cacheKeyIdentity$ } from './createCacheKey.js'

describe('cacheKeyIdentity$', () => {
  it('emits undefined when template is undefined', async () => {
    const cm = { registerCacheKey: vi.fn() } as unknown as ICacheManager<ServiceLink>

    const result = await firstValueFrom(
      cacheKeyIdentity$(cm, EMPTY, of<CacheKeyTemplate<ServiceLink> | undefined>(undefined)),
    )

    expect(result).toBeUndefined()
  })

  it('emits registered identity from registerCacheKey', async () => {
    const identity: EntityCacheKey<ServiceLink> = {
      kind: 'entity',
      key: 'uuid-1',
      link: { service: 'nb', type: 'Notebook', id: 'client-1' },
    }
    const cm = {
      registerCacheKey: vi.fn().mockResolvedValue(identity),
    } as unknown as ICacheManager<ServiceLink>

    const result = await firstValueFrom(
      cacheKeyIdentity$(cm, EMPTY, of<CacheKeyTemplate<ServiceLink>>(entityTemplate('client-1'))),
    )

    expect(result).toEqual(identity)
  })

  it('emits reconciled identity after initial', async () => {
    const identity: EntityCacheKey<ServiceLink> = {
      kind: 'entity',
      key: 'uuid-1',
      link: { service: 'nb', type: 'Notebook', id: 'client-1' },
    }
    const reconciled: EntityCacheKey<ServiceLink> = {
      kind: 'entity',
      key: 'uuid-1',
      link: { service: 'nb', type: 'Notebook', id: 'server-1' },
    }
    const cm = {
      registerCacheKey: vi.fn().mockResolvedValue(identity),
    } as unknown as ICacheManager<ServiceLink>

    const events$ = new Subject<LibraryEvent<ServiceLink>>()

    const collected = firstValueFrom(
      cacheKeyIdentity$(
        cm,
        events$,
        of<CacheKeyTemplate<ServiceLink>>(entityTemplate('client-1')),
      ).pipe(take(2), toArray()),
    )

    // registerCacheKey promise resolves on next microtask, then events$ is subscribed
    await firstValueFrom(
      cacheKeyIdentity$(cm, EMPTY, of<CacheKeyTemplate<ServiceLink>>(entityTemplate('client-1'))),
    )

    events$.next({
      type: 'cache:key-reconciled',
      data: {
        cacheKey: reconciled,
        previousIdentity: identity,
        commandId: 'cmd-1',
        clientId: 'client-1',
        serverId: 'server-1',
      },
      timestamp: 0,
    } as LibraryEvent<ServiceLink, 'cache:key-reconciled'>)

    expect(await collected).toEqual([identity, reconciled])
  })

  it('ignores reconciliation events for other keys', async () => {
    const identity: EntityCacheKey<ServiceLink> = {
      kind: 'entity',
      key: 'uuid-1',
      link: { service: 'nb', type: 'Notebook', id: 'client-1' },
    }
    const otherReconciled: EntityCacheKey<ServiceLink> = {
      kind: 'entity',
      key: 'uuid-other',
      link: { service: 'nb', type: 'Notebook', id: 'other-srv' },
    }
    const cm = {
      registerCacheKey: vi.fn().mockResolvedValue(identity),
    } as unknown as ICacheManager<ServiceLink>

    // Events stream with a reconciliation for a different key
    const events$ = of<LibraryEvent<ServiceLink>>({
      type: 'cache:key-reconciled',
      data: {
        cacheKey: otherReconciled,
        previousIdentity: otherReconciled,
        commandId: 'cmd-2',
        clientId: 'other',
        serverId: 'other-srv',
      },
      timestamp: 0,
    } as LibraryEvent<ServiceLink, 'cache:key-reconciled'>)

    const result = await firstValueFrom(
      cacheKeyIdentity$(cm, events$, of<CacheKeyTemplate<ServiceLink>>(entityTemplate('client-1'))),
    )

    // Should get the initial identity, not the unrelated reconciliation
    expect(result).toEqual(identity)
  })

  it('switches to new registration when template changes', async () => {
    const identity1: EntityCacheKey<ServiceLink> = {
      kind: 'entity',
      key: 'uuid-1',
      link: { service: 'nb', type: 'Notebook', id: '1' },
    }
    const identity2: EntityCacheKey<ServiceLink> = {
      kind: 'entity',
      key: 'uuid-2',
      link: { service: 'nb', type: 'Notebook', id: '2' },
    }
    const cm = {
      registerCacheKey: vi.fn().mockResolvedValueOnce(identity1).mockResolvedValueOnce(identity2),
    } as unknown as ICacheManager<ServiceLink>

    const template$ = new Subject<CacheKeyTemplate<ServiceLink> | undefined>()

    const collected = firstValueFrom(
      cacheKeyIdentity$(cm, EMPTY, template$).pipe(take(2), toArray()),
    )

    template$.next(entityTemplate('1'))
    // Wait for first promise to resolve before switching
    await Promise.resolve()
    template$.next(entityTemplate('2'))

    expect(await collected).toEqual([identity1, identity2])
  })
})

function entityTemplate(id: string): EntityCacheKeyTemplate<ServiceLink> {
  return { kind: 'entity', link: { service: 'nb', type: 'Notebook', id } }
}
