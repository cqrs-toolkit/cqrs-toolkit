/**
 * Unit tests for ConnectivityManager.
 */

import type { ServiceLink } from '@meticoeus/ddd-es'
import { take } from 'rxjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EventBus } from '../events/EventBus.js'
import { ConnectivityManager } from './ConnectivityManager.js'

describe('ConnectivityManager', () => {
  let eventBus: EventBus<ServiceLink>
  let connectivity: ConnectivityManager<ServiceLink>

  beforeEach(() => {
    eventBus = new EventBus()
    connectivity = new ConnectivityManager(eventBus)
  })

  afterEach(() => {
    connectivity.destroy()
  })

  describe('initial state', () => {
    it('starts with browser online status', () => {
      const state = connectivity.getState()
      expect(state.network).toBe('online') // jsdom default
      expect(state.serverReachable).toBe('unknown')
      expect(state.lastContact).toBeUndefined()
    })

    it('reports not online initially (server reachability unknown)', () => {
      expect(connectivity.isOnline()).toBe(false)
    })
  })

  describe('reportContact', () => {
    it('sets serverReachable to yes', () => {
      connectivity.reportContact()

      const state = connectivity.getState()
      expect(state.serverReachable).toBe('yes')
      expect(state.lastContact).toBeTruthy()
    })

    it('makes isOnline return true when browser is online', () => {
      connectivity.reportContact()
      expect(connectivity.isOnline()).toBe(true)
    })

    it('emits connectivity:changed event', async () => {
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
      connectivity.reportContact() // First go online
      connectivity.reportFailure()

      const state = connectivity.getState()
      expect(state.serverReachable).toBe('no')
    })

    it('emits connectivity:changed event', async () => {
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
