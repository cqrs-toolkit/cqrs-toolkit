/**
 * Unit tests for ConnectivityManager.
 */

import type { ServiceLink } from '@meticoeus/ddd-es'
import { take } from 'rxjs'
import { afterEach, describe, expect, it } from 'vitest'
import { EventBus } from '../events/EventBus.js'
import { ConnectivityManager } from './ConnectivityManager.js'

describe('ConnectivityManager', () => {
  let cleanup: (() => void)[] = []

  afterEach(() => {
    for (const fn of cleanup) fn()
    cleanup = []
  })

  function bootstrap() {
    const eventBus = new EventBus<ServiceLink>()
    const connectivity = new ConnectivityManager<ServiceLink>(eventBus)
    cleanup.push(() => connectivity.destroy())
    return { connectivity, eventBus }
  }

  describe('initial state', () => {
    it('starts with browser online status', () => {
      const { connectivity } = bootstrap()
      const state = connectivity.getState()
      expect(state.network).toBe('online') // jsdom default
      expect(state.serverReachable).toBe('unknown')
      expect(state.lastContact).toBeUndefined()
    })

    it('reports not online initially (server reachability unknown)', () => {
      const { connectivity } = bootstrap()
      expect(connectivity.isOnline()).toBe(false)
    })
  })

  describe('reportContact', () => {
    it('sets serverReachable to yes', () => {
      const { connectivity } = bootstrap()
      connectivity.reportContact()

      const state = connectivity.getState()
      expect(state.serverReachable).toBe('yes')
      expect(state.lastContact).toBeTruthy()
    })

    it('makes isOnline return true when browser is online', () => {
      const { connectivity } = bootstrap()
      connectivity.reportContact()
      expect(connectivity.isOnline()).toBe(true)
    })

    it('emits connectivity:changed event', async () => {
      const { connectivity, eventBus } = bootstrap()
      const events: unknown[] = []
      eventBus.on('connectivity:changed').subscribe((e) => events.push(e))

      connectivity.reportContact()

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: { online: true },
      })
    })
  })

  describe('reportFailure', () => {
    it('sets serverReachable to no', () => {
      const { connectivity } = bootstrap()
      connectivity.reportContact() // First go online
      connectivity.reportFailure()

      const state = connectivity.getState()
      expect(state.serverReachable).toBe('no')
    })

    it('emits connectivity:changed event', async () => {
      const { connectivity, eventBus } = bootstrap()
      connectivity.reportContact() // Go online first

      const events: unknown[] = []
      eventBus.on('connectivity:changed').subscribe((e) => events.push(e))

      connectivity.reportFailure()

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: { online: false },
      })
    })
  })

  describe('online$', () => {
    it('emits distinct online status changes', async () => {
      const { connectivity } = bootstrap()
      const values: boolean[] = []
      connectivity.online$.pipe(take(3)).subscribe((v) => values.push(v))

      connectivity.reportContact() // true
      connectivity.reportContact() // true (duplicate, should not emit)
      connectivity.reportFailure() // false
      connectivity.reportContact() // true

      // Wait for emissions
      await new Promise((r) => setTimeout(r, 10))

      expect(values).toEqual([false, true, false]) // initial false, then true, then false
    })
  })

  describe('state observable', () => {
    it('emits state changes', async () => {
      const { connectivity } = bootstrap()
      const states: unknown[] = []
      connectivity.state.pipe(take(2)).subscribe((s) => states.push(s))

      connectivity.reportContact()

      expect(states).toHaveLength(2)
      expect(states[1]).toMatchObject({
        serverReachable: 'yes',
      })
    })
  })

  describe('lifecycle', () => {
    it('stop() cleans up browser event subscription', () => {
      const { connectivity } = bootstrap()
      connectivity.start()

      // After start, browserSub should exist (via the merge subscription)
      // After stop, it should be cleaned up
      connectivity.stop()

      // Verify state is no longer updated by browser events
      const stateBefore = connectivity.getState()
      window.dispatchEvent(new Event('offline'))
      const stateAfter = connectivity.getState()

      expect(stateAfter.network).toBe(stateBefore.network)
    })

    it('destroy() cleans up browser event subscription', () => {
      const eventBus = new EventBus<ServiceLink>()
      const connectivity = new ConnectivityManager<ServiceLink>(eventBus)
      connectivity.start()
      connectivity.destroy()

      // Verify state is no longer updated by browser events
      const stateBefore = connectivity.getState()
      window.dispatchEvent(new Event('offline'))
      const stateAfter = connectivity.getState()

      expect(stateAfter.network).toBe(stateBefore.network)
    })
  })
})
