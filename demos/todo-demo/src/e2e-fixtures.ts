import type { ExecutionMode } from '@cqrs-toolkit/client'
import { formatEventBusTimeline } from '@cqrs-toolkit/client/fixtures'
import { test as base, type TestInfo } from '@playwright/test'
;(BigInt.prototype as any)['toJSON'] = function () {
  return this.toString()
}

interface ModeFixtures {
  mode: ExecutionMode
}

export const test = base.extend<ModeFixtures>({
  mode: ['online-only', { option: true }],
})

export function setupTestDiagnostics() {
  test.afterEach(async ({ page, request }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await dumpCqrsEvents(page, testInfo)
    }
    try {
      await request.post('http://localhost:3001/api/test/ws-resume')
    } catch {
      // Best-effort: don't let cleanup failures crash the test runner.
    }
  })
}

export async function dumpCqrsEvents(page: import('@playwright/test').Page, testInfo: TestInfo) {
  try {
    const events = await page.evaluate(() => window.__CQRS_EVENTS__)
    if (!events?.length) {
      process.stderr.write('CQRS Event Log: no events captured\n')
      return
    }
    const output = formatEventBusTimeline(events)
    await testInfo.attach('cqrs-events', { body: output, contentType: 'text/plain' })
    process.stderr.write(output)
  } catch (err) {
    process.stderr.write(`CQRS Event Log: dump failed — ${err}\n`)
  }
}

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
