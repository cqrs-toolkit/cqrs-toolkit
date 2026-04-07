/**
 * Fake user session — cookie-based random user IDs for the demo.
 *
 * Assigns a random UUID as a user ID on first visit (via a `demo_user_id` cookie).
 * When the server resets (e.g. between e2e tests), the user store is cleared,
 * so returning clients get a new user ID and the CQRS client's SessionManager
 * wipes stale local data.
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { v4 as uuidv4 } from 'uuid'

// ── Types ──

interface FakeUser {
  sub: string
}

interface SessionView {
  authenticated: true
  user: FakeUser
  expiresAtMs: number
}

// ── Cookie parsing ──

const SESSION_COOKIE_NAME = 'demo_user_id'
const COOKIE_MAX_AGE = 31_536_000 // 1 year in seconds
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

/** Extract a named cookie value from a raw Cookie header string. */
export function parseCookieHeader(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined

  for (const pair of header.split(';')) {
    const eqIndex = pair.indexOf('=')
    if (eqIndex === -1) continue
    const key = pair.slice(0, eqIndex).trim()
    if (key === name) {
      return pair.slice(eqIndex + 1).trim()
    }
  }

  return undefined
}

// ── User store ──

export class FakeUserStore {
  private readonly users = new Map<string, FakeUser>()

  get(id: string): FakeUser | undefined {
    return this.users.get(id)
  }

  create(): FakeUser {
    const sub = uuidv4()
    const user: FakeUser = { sub }
    this.users.set(sub, user)
    return user
  }

  clear(): void {
    this.users.clear()
  }
}

// ── Route plugin ──

export function sessionRoutes(userStore: FakeUserStore): FastifyPluginAsync {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.get<{ Reply: SessionView }>('/session', async (request, reply) => {
      const cookieValue = parseCookieHeader(request.headers.cookie, SESSION_COOKIE_NAME)

      const user =
        cookieValue !== undefined
          ? (userStore.get(cookieValue) ?? userStore.create())
          : userStore.create()

      reply.header(
        'Set-Cookie',
        `${SESSION_COOKIE_NAME}=${user.sub}; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
      )

      const session: SessionView = {
        authenticated: true,
        user,
        expiresAtMs: Date.now() + SESSION_DURATION_MS,
      }
      return session
    })
  }
}
