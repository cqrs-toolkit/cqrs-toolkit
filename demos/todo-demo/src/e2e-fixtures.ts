import type { ExecutionMode } from '@cqrs-toolkit/client'
import { test as base } from '@playwright/test'

interface ModeFixtures {
  mode: ExecutionMode
}

export const test = base.extend<ModeFixtures>({
  mode: ['online-only', { option: true }],
})

export { expect } from '@playwright/test'

/**
 * Session-to-port mapping.
 * Each session runs on a separate origin for OPFS isolation in worker modes.
 */
const SESSION_PORTS = {
  a: 5173,
  b: 5174,
} as const

interface UrlParams {
  mode: string
  ws: boolean
  /** Which client session to target. Default: 'a' (primary). */
  session?: 'a' | 'b'
}

/**
 * Build a test URL with mode and ws query parameters.
 *
 * Session 'a' (default): returns a relative path (resolved against Playwright's baseURL).
 * Other sessions: returns a full URL on that session's origin.
 */
export function url(path: string, params: UrlParams): string {
  const relative = `${path}?mode=${params.mode}&ws=${params.ws}`
  const session = params.session ?? 'a'
  if (session === 'a') return relative
  return `http://localhost:${SESSION_PORTS[session]}${relative}`
}
