/**
 * Session manager handles user identity and session lifecycle.
 *
 * Key behaviors:
 * - Single session at a time
 * - Offline-first: can start with cached session before authentication
 * - User change triggers full data wipe
 */

import { Link } from '@meticoeus/ddd-es'
import type { IStorage, SessionRecord } from '../../storage/IStorage.js'
import { EnqueueCommand } from '../../types/index.js'
import type { EventBus } from '../events/EventBus.js'

/**
 * Authentication state.
 */
export type AuthState = { status: 'unauthenticated' } | { status: 'authenticated'; userId: string }

/**
 * Session state.
 */
export type SessionState =
  | { status: 'uninitialized' }
  | { status: 'no-session' }
  | { status: 'cached'; session: SessionRecord }
  | { status: 'active'; session: SessionRecord }

/**
 * Session manager configuration.
 */
export interface SessionManagerConfig<TLink extends Link, TCommand extends EnqueueCommand> {
  storage: IStorage<TLink, TCommand>
  eventBus: EventBus<TLink>
}

/**
 * Session manager.
 * Coordinates user identity with persisted session data.
 */
export class SessionManager<TLink extends Link, TCommand extends EnqueueCommand> {
  private readonly storage: IStorage<TLink, TCommand>
  private readonly eventBus: EventBus<TLink>

  private sessionState: SessionState = { status: 'uninitialized' }
  private authState: AuthState = { status: 'unauthenticated' }
  private networkPaused = true

  constructor(config: SessionManagerConfig<TLink, TCommand>) {
    this.storage = config.storage
    this.eventBus = config.eventBus
  }

  /**
   * Get the current session state.
   */
  getSessionState(): SessionState {
    return this.sessionState
  }

  /**
   * Get the current authentication state.
   */
  getAuthState(): AuthState {
    return this.authState
  }

  /**
   * Check if network operations are paused.
   * Network is paused until authentication is confirmed.
   */
  isNetworkPaused(): boolean {
    return this.networkPaused
  }

  /**
   * Get the current user ID, if any.
   */
  getUserId(): string | undefined {
    if (this.sessionState.status === 'cached' || this.sessionState.status === 'active') {
      return this.sessionState.session.userId
    }
    return undefined
  }

  /**
   * Initialize the session manager.
   * Loads any existing session from storage.
   * Does not resume network activity.
   */
  async initialize(): Promise<void> {
    const session = await this.storage.getSession()

    if (session) {
      this.sessionState = { status: 'cached', session }
    } else {
      this.sessionState = { status: 'no-session' }
    }

    // Network remains paused until signalAuthenticated is called
    this.networkPaused = true
  }

  /**
   * Signal that the user has been authenticated.
   * This is called by the host application after successful authentication.
   *
   * If the userId differs from the cached session, all data is wiped.
   *
   * @param userId - The authenticated user's ID
   * @returns Whether the session was resumed (true) or created new (false)
   */
  async signalAuthenticated(userId: string): Promise<{ resumed: boolean }> {
    const now = Date.now()
    this.authState = { status: 'authenticated', userId }

    const existingSession =
      this.sessionState.status === 'cached' || this.sessionState.status === 'active'
        ? this.sessionState.session
        : undefined

    if (existingSession) {
      if (existingSession.userId === userId) {
        // Same user — resume session
        const updatedSession: SessionRecord = {
          ...existingSession,
          lastSeenAt: now,
        }
        await this.storage.saveSession(updatedSession)
        this.sessionState = { status: 'active', session: updatedSession }
        this.networkPaused = false

        this.eventBus.emit('session:changed', { userId, isNew: false })

        return { resumed: true }
      } else {
        // Different user — wipe and create new session
        await this.wipeAndCreateSession(userId, now)
        return { resumed: false }
      }
    } else {
      // No existing session — create new
      await this.createSession(userId, now)
      return { resumed: false }
    }
  }

  /**
   * Signal that the user has been logged out.
   * Clears all session data and pauses network activity.
   */
  async signalLoggedOut(): Promise<void> {
    this.authState = { status: 'unauthenticated' }
    this.networkPaused = true

    if (this.sessionState.status === 'cached' || this.sessionState.status === 'active') {
      await this.storage.deleteSession()
      this.eventBus.emit('session:destroyed', { reason: 'explicit' })
    }

    this.sessionState = { status: 'no-session' }
  }

  /**
   * Touch the session to update last seen timestamp.
   * Should be called periodically during active use.
   */
  async touchSession(): Promise<void> {
    if (this.sessionState.status === 'active') {
      await this.storage.touchSession()
      const session = await this.storage.getSession()
      if (session) {
        this.sessionState = { status: 'active', session }
      }
    }
  }

  /**
   * Create a new session for a user.
   */
  private async createSession(userId: string, now: number): Promise<void> {
    const session: SessionRecord = {
      id: 1,
      userId,
      createdAt: now,
      lastSeenAt: now,
    }

    await this.storage.saveSession(session)
    this.sessionState = { status: 'active', session }
    this.networkPaused = false

    this.eventBus.emit('session:changed', { userId, isNew: true })
  }

  /**
   * Wipe all data and create a new session.
   * Called when the user identity changes.
   */
  private async wipeAndCreateSession(userId: string, now: number): Promise<void> {
    // Emit destroy event before wiping
    this.eventBus.emit('session:destroyed', { reason: 'user-changed' })

    // Wipe all data
    await this.storage.deleteSession()

    // Create new session
    await this.createSession(userId, now)
  }
}
