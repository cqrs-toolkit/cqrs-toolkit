import { type BrowserContext, type Page, test as base } from '@playwright/test'
import { resolve } from 'node:path'

const DEVTOOLS_DIST = resolve(import.meta.dirname, '../../../../packages/devtools/dist')

// ---------------------------------------------------------------------------
// Fixture types
// ---------------------------------------------------------------------------

interface ExtensionFixtures {
  extensionContext: BrowserContext
  extensionPage: Page
}

interface MockPanelFixtures {
  mockPanelPage: Page
}

// ---------------------------------------------------------------------------
// Exported test instance with both fixture types
// ---------------------------------------------------------------------------

export const test = base.extend<ExtensionFixtures & MockPanelFixtures>({
  // Layer 1: Persistent context with extension loaded
  extensionContext: async ({}, use) => {
    const { chromium } = await import('@playwright/test')
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [`--disable-extensions-except=${DEVTOOLS_DIST}`, `--load-extension=${DEVTOOLS_DIST}`],
    })
    await use(context)
    await context.close()
  },

  extensionPage: async ({ extensionContext }, use) => {
    const page = extensionContext.pages()[0] ?? (await extensionContext.newPage())
    await use(page)
  },

  // Layer 2: Regular page with chrome API mocks
  mockPanelPage: async ({ browser }, use) => {
    const page = await browser.newPage()

    await page.addInitScript(() => {
      const testMock = {
        portListeners: [] as Array<(msg: unknown) => void>,
        outgoing: [] as unknown[],
        disconnectListeners: [] as Array<() => void>,
      }

      ;(window as unknown as Record<string, unknown>)['__TEST_MOCK__'] = testMock

      const chromeStub = {
        runtime: {
          connect({ name }: { name: string }) {
            return {
              name,
              postMessage(msg: unknown) {
                testMock.outgoing.push(msg)
              },
              onMessage: {
                addListener(cb: (msg: unknown) => void) {
                  testMock.portListeners.push(cb)
                },
              },
              onDisconnect: {
                addListener(cb: () => void) {
                  testMock.disconnectListeners.push(cb)
                },
              },
            }
          },
        },
        devtools: {
          inspectedWindow: { tabId: 1 },
          panels: { themeName: 'dark' },
        },
      }

      ;(window as unknown as Record<string, unknown>)['chrome'] = chromeStub
    })

    await page.goto('http://localhost:5180/panel.html')
    await use(page)
    await page.close()
  },
})

export { expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers for Layer 2 panel tests
// ---------------------------------------------------------------------------

export async function sendToPanel(page: Page, msg: unknown): Promise<void> {
  await page.evaluate((m) => {
    const mock = (window as unknown as Record<string, unknown>)['__TEST_MOCK__'] as {
      portListeners: Array<(msg: unknown) => void>
    }
    for (const cb of mock.portListeners) {
      cb(m)
    }
  }, msg)
}

export async function getOutgoing(page: Page): Promise<unknown[]> {
  return page.evaluate(() => {
    const mock = (window as unknown as Record<string, unknown>)['__TEST_MOCK__'] as {
      outgoing: unknown[]
    }
    return mock.outgoing
  })
}
