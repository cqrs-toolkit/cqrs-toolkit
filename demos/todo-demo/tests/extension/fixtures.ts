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
        // In-memory store for chrome.storage.local stubs.
        storage: {} as Record<string, unknown>,
        // chrome.devtools.network.onRequestFinished listeners (HAR pipe).
        networkListeners: [] as Array<(entry: unknown) => void>,
        // The origin reported back from chrome.devtools.inspectedWindow.eval
        // for the 'location.origin' query the Network tab uses.
        inspectedOrigin: 'http://localhost:5173',
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
        storage: {
          local: {
            get(keys: string | string[] | null) {
              return new Promise((resolve) => {
                const out: Record<string, unknown> = {}
                if (keys === null || keys === undefined) {
                  Object.assign(out, testMock.storage)
                } else if (typeof keys === 'string') {
                  if (keys in testMock.storage) out[keys] = testMock.storage[keys]
                } else {
                  for (const k of keys) {
                    if (k in testMock.storage) out[k] = testMock.storage[k]
                  }
                }
                resolve(out)
              })
            },
            set(items: Record<string, unknown>) {
              return new Promise((resolve) => {
                Object.assign(testMock.storage, items)
                resolve(undefined)
              })
            },
          },
        },
        devtools: {
          inspectedWindow: {
            tabId: 1,
            eval(_expression: string, ...args: unknown[]): void {
              const cb = (typeof args[0] === 'function' ? args[0] : args[1]) as
                | ((result: unknown, exceptionInfo?: unknown) => void)
                | undefined
              if (typeof cb === 'function') cb(testMock.inspectedOrigin)
            },
          },
          panels: { themeName: 'dark' },
          network: {
            onRequestFinished: {
              addListener(cb: (entry: unknown) => void) {
                testMock.networkListeners.push(cb)
              },
            },
          },
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

/**
 * Simulate a chrome.devtools.network.onRequestFinished HAR entry — used by the
 * Network panel's panel-side HAR pipe.
 */
export async function sendHarEntry(page: Page, entry: unknown): Promise<void> {
  await page.evaluate((e) => {
    const mock = (window as unknown as Record<string, unknown>)['__TEST_MOCK__'] as {
      networkListeners: Array<(entry: unknown) => void>
    }
    for (const cb of mock.networkListeners) cb(e)
  }, entry)
}

/** Read chrome.storage.local stub state — used to verify persistence. */
export async function getStoredPref(page: Page, key: string): Promise<unknown> {
  return page.evaluate((k) => {
    const mock = (window as unknown as Record<string, unknown>)['__TEST_MOCK__'] as {
      storage: Record<string, unknown>
    }
    return mock.storage[k]
  }, key)
}

/** Seed a preference value in chrome.storage.local before the panel mounts. */
export async function seedStoredPref(page: Page, key: string, value: unknown): Promise<void> {
  await page.evaluate(
    ({ k, v }) => {
      const mock = (window as unknown as Record<string, unknown>)['__TEST_MOCK__'] as {
        storage: Record<string, unknown>
      }
      mock.storage[k] = v
    },
    { k: key, v: value },
  )
}
