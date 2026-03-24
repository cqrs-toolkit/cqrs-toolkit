/**
 * Unit tests for SessionManager.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import type { SessionRecord } from '../../storage/IStorage.js'
import { EventBus } from '../events/EventBus.js'
import { SessionManager } from './SessionManager.js'

describe('SessionManager', () => {
  let storage: InMemoryStorage
  let eventBus: EventBus
  let sessionManager: SessionManager

  beforeEach(async () => {
    storage = new InMemoryStorage()
    await storage.initialize()
    eventBus = new EventBus()
    sessionManager = new SessionManager({ storage, eventBus })
  })

  describe('initialization', () => {
    it('starts with uninitialized state', () => {
      expect(sessionManager.getSessionState()).toEqual({ status: 'uninitialized' })
    })

    it('initializes with no-session when storage is empty', async () => {
      await sessionManager.initialize()

      expect(sessionManager.getSessionState()).toEqual({ status: 'no-session' })
    })

    it('initializes with cached session when storage has session', async () => {
      const session: SessionRecord = {
        id: 1,
        userId: 'user-1',
        createdAt: 1000,
        lastSeenAt: 1000,
      }
      await storage.saveSession(session)

      await sessionManager.initialize()

      expect(sessionManager.getSessionState()).toMatchObject({
        status: 'cached',
        session: { userId: 'user-1' },
      })
    })

    it('network is paused after initialization', async () => {
      await sessionManager.initialize()

      expect(sessionManager.isNetworkPaused()).toBe(true)
    })
  })

  describe('authentication signaling', () => {
    it('creates new session when no prior session exists', async () => {
      await sessionManager.initialize()

      const result = await sessionManager.signalAuthenticated('user-1')

      expect(result.resumed).toBe(false)
      expect(sessionManager.getSessionState().status).toBe('active')
      expect(sessionManager.getUserId()).toBe('user-1')
      expect(sessionManager.isNetworkPaused()).toBe(false)
    })

    it('resumes session when userId matches cached session', async () => {
      const session: SessionRecord = {
        id: 1,
        userId: 'user-1',
        createdAt: 1000,
        lastSeenAt: 1000,
      }
      await storage.saveSession(session)
      await sessionManager.initialize()

      const result = await sessionManager.signalAuthenticated('user-1')

      expect(result.resumed).toBe(true)
      expect(sessionManager.getSessionState().status).toBe('active')
    })

    it('wipes data and creates new session when userId differs', async () => {
      const session: SessionRecord = {
        id: 1,
        userId: 'user-1',
        createdAt: 1000,
        lastSeenAt: 1000,
      }
      await storage.saveSession(session)
      await sessionManager.initialize()

      const result = await sessionManager.signalAuthenticated('user-2')

      expect(result.resumed).toBe(false)
      expect(sessionManager.getUserId()).toBe('user-2')
    })

    it('emits session:changed event on new session', async () => {
      await sessionManager.initialize()
      const events: unknown[] = []
      eventBus.on('session:changed').subscribe((e) => events.push(e))

      await sessionManager.signalAuthenticated('user-1')

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: { userId: 'user-1', isNew: true },
      })
    })

    it('emits session:changed event on resumed session', async () => {
      const session: SessionRecord = {
        id: 1,
        userId: 'user-1',
        createdAt: 1000,
        lastSeenAt: 1000,
      }
      await storage.saveSession(session)
      await sessionManager.initialize()
      const events: unknown[] = []
      eventBus.on('session:changed').subscribe((e) => events.push(e))

      await sessionManager.signalAuthenticated('user-1')

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: { userId: 'user-1', isNew: false },
      })
    })

    it('emits session:destroyed before creating new session on user change', async () => {
      const session: SessionRecord = {
        id: 1,
        userId: 'user-1',
        createdAt: 1000,
        lastSeenAt: 1000,
      }
      await storage.saveSession(session)
      await sessionManager.initialize()
      const events: string[] = []
      eventBus.events$.subscribe((e) => events.push(e.type))

      await sessionManager.signalAuthenticated('user-2')

      expect(events).toEqual(['session:destroyed', 'session:changed'])
    })

    it('wipes data and creates new session when userId differs from active session', async () => {
      await sessionManager.initialize()
      await sessionManager.signalAuthenticated('user-1')

      // Verify we're in active state as user-1
      expect(sessionManager.getSessionState().status).toBe('active')
      expect(sessionManager.getUserId()).toBe('user-1')

      const events: string[] = []
      eventBus.events$.subscribe((e) => events.push(e.type))

      const result = await sessionManager.signalAuthenticated('user-2')

      expect(result.resumed).toBe(false)
      expect(sessionManager.getUserId()).toBe('user-2')
      // Storage should have been wiped — no leftover data from user-1
      const session = await storage.getSession()
      expect(session?.userId).toBe('user-2')
      // session:destroyed should be emitted before session:changed
      expect(events).toEqual(['session:destroyed', 'session:changed'])
    })

    it('resumes session when same userId is signaled while active', async () => {
      await sessionManager.initialize()
      await sessionManager.signalAuthenticated('user-1')

      const result = await sessionManager.signalAuthenticated('user-1')

      expect(result.resumed).toBe(true)
      expect(sessionManager.getUserId()).toBe('user-1')
      expect(sessionManager.getSessionState().status).toBe('active')
    })

    it('updates auth state on authentication', async () => {
      await sessionManager.initialize()

      expect(sessionManager.getAuthState()).toEqual({ status: 'unauthenticated' })

      await sessionManager.signalAuthenticated('user-1')

      expect(sessionManager.getAuthState()).toEqual({ status: 'authenticated', userId: 'user-1' })
    })
  })

  describe('logout', () => {
    it('clears session and pauses network', async () => {
      await sessionManager.initialize()
      await sessionManager.signalAuthenticated('user-1')

      await sessionManager.signalLoggedOut()

      expect(sessionManager.getSessionState()).toEqual({ status: 'no-session' })
      expect(sessionManager.getAuthState()).toEqual({ status: 'unauthenticated' })
      expect(sessionManager.isNetworkPaused()).toBe(true)
    })

    it('emits session:destroyed event', async () => {
      await sessionManager.initialize()
      await sessionManager.signalAuthenticated('user-1')
      const events: unknown[] = []
      eventBus.on('session:destroyed').subscribe((e) => events.push(e))

      await sessionManager.signalLoggedOut()

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        data: { reason: 'explicit' },
      })
    })

    it('clears storage', async () => {
      await sessionManager.initialize()
      await sessionManager.signalAuthenticated('user-1')

      await sessionManager.signalLoggedOut()

      expect(await storage.getSession()).toBeUndefined()
    })
  })

  describe('touch session', () => {
    it('updates lastSeenAt for active session', async () => {
      await sessionManager.initialize()
      await sessionManager.signalAuthenticated('user-1')

      const before = sessionManager.getSessionState()
      const beforeLastSeen = before.status === 'active' ? before.session.lastSeenAt : 0

      await new Promise((r) => setTimeout(r, 10))
      await sessionManager.touchSession()

      const after = sessionManager.getSessionState()
      const afterLastSeen = after.status === 'active' ? after.session.lastSeenAt : 0

      expect(afterLastSeen).toBeGreaterThan(beforeLastSeen)
    })

    it('does nothing for non-active session', async () => {
      await sessionManager.initialize()

      // Should not throw
      await sessionManager.touchSession()

      expect(sessionManager.getSessionState()).toEqual({ status: 'no-session' })
    })
  })

  describe('getUserId', () => {
    it('returns undefined when no session', async () => {
      await sessionManager.initialize()

      expect(sessionManager.getUserId()).toBeUndefined()
    })

    it('returns userId for cached session', async () => {
      const session: SessionRecord = {
        id: 1,
        userId: 'user-1',
        createdAt: 1000,
        lastSeenAt: 1000,
      }
      await storage.saveSession(session)
      await sessionManager.initialize()

      expect(sessionManager.getUserId()).toBe('user-1')
    })

    it('returns userId for active session', async () => {
      await sessionManager.initialize()
      await sessionManager.signalAuthenticated('user-1')

      expect(sessionManager.getUserId()).toBe('user-1')
    })
  })
})
