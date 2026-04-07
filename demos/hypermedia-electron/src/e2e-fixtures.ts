/**
 * Playwright fixtures for Electron e2e tests.
 *
 * Launches the Electron app per test, provides the renderer window as `page`,
 * and cleans up on teardown. The standard Playwright Page API works against
 * the Electron renderer — shared e2e-helpers from hypermedia-base work unchanged.
 */

import {
  test as base,
  _electron as electron,
  type ElectronApplication,
  type Page,
  type TestInfo,
} from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST_DIR = join(__dirname, '..', 'dist')

interface ElectronFixtures {
  electronApp: ElectronApplication
  page: Page
}

export const SERVER = 'http://localhost:3002'

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [join(DIST_DIR, 'main.js')],
    })
    await use(app)
    await app.close()
  },
  page: async ({ electronApp, request }, use) => {
    const page = await electronApp.firstWindow()
    await request.post(`${SERVER}/api/test/reset`)
    await request.post(`${SERVER}/api/test/ws-resume`)
    await use(page)
  },
})

test.afterEach(async ({ page, request }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus && page) {
    await dumpCqrsEvents(page, testInfo)
  }
})

async function dumpCqrsEvents(page: Page, testInfo: TestInfo) {
  try {
    const events = await page.evaluate(() => {
      const replacer = (_k: string, v: unknown) => (typeof v === 'bigint' ? `${v}n` : v)
      return window.__CQRS_EVENTS__?.map((e) => ({
        type: e.type,
        data: JSON.parse(JSON.stringify(e.data, replacer)) as unknown,
        ...(e.debug ? { debug: true } : {}),
      }))
    })
    if (!events?.length) {
      process.stderr.write('CQRS Event Log: no events captured\n')
      return
    }

    const lines = events.map((e, i) => {
      const tag = e.debug ? ' [debug]' : ''
      const data = JSON.stringify(e.data, null, 2).replace(/\n/g, '\n    ')
      return `  ${String(i + 1).padStart(3)}. ${e.type}${tag}\n    ${data}`
    })

    const output = `CQRS Event Log (${events.length} events):\n${lines.join('\n')}\n`
    await testInfo.attach('cqrs-events', { body: output, contentType: 'text/plain' })
    process.stderr.write(output)
  } catch (err) {
    process.stderr.write(`CQRS Event Log: dump failed — ${err}\n`)
  }
}

export { expect } from '@playwright/test'
