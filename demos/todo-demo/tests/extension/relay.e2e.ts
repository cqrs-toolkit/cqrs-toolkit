import { expect, test } from './fixtures.js'

const APP_URL = 'http://localhost:5173/todos?mode=online-only&ws=false'

/**
 * Init script that captures hook messages posted to the window.
 * Must be added via page.addInitScript() BEFORE navigation.
 */
const CAPTURE_HOOK_MESSAGES = `
  window.__TEST_HOOK_MESSAGES__ = [];
  window.addEventListener('message', (event) => {
    if (event.data && event.data.source === 'cqrs-hook') {
      window.__TEST_HOOK_MESSAGES__.push(event.data);
    }
  });
`

function getCapturedMessages(
  page: import('@playwright/test').Page,
): Promise<Array<{ type: string; source: string; [key: string]: unknown }>> {
  return page.evaluate(() => {
    return (window as unknown as Record<string, unknown>)['__TEST_HOOK_MESSAGES__'] as Array<{
      type: string
      source: string
    }>
  })
}

test.describe('Layer 1: Relay integration', () => {
  test('hook is present at document_start', async ({ extensionPage: page }) => {
    await page.goto(APP_URL)

    const hasHook = await page.evaluate(() => {
      const hook = (window as unknown as Record<string, unknown>)['__CQRS_TOOLKIT_DEVTOOLS__']
      return typeof (hook as Record<string, unknown> | undefined)?.registerClient === 'function'
    })

    expect(hasHook).toBe(true)
  })

  test('client registers with hook', async ({ extensionPage: page }) => {
    await page.addInitScript(CAPTURE_HOOK_MESSAGES)
    await page.goto(APP_URL)

    // Wait for client to register (it does so when CqrsClient initializes)
    await page.waitForFunction(() => {
      const msgs = (window as unknown as Record<string, unknown>)['__TEST_HOOK_MESSAGES__'] as
        | Array<{ type: string }>
        | undefined
      return msgs && msgs.some((m) => m.type === 'cqrs-devtools-client-detected')
    })

    const messages = await getCapturedMessages(page)
    const detected = messages.find((m) => m.type === 'cqrs-devtools-client-detected')

    expect(detected).toBeDefined()
    expect(detected!.config).toBeDefined()
    expect(detected!.role).toBeDefined()
  })

  test('events flow when activated', async ({ extensionPage: page }) => {
    await page.addInitScript(CAPTURE_HOOK_MESSAGES)
    await page.goto(APP_URL)

    // Wait for client to register
    await page.waitForFunction(() => {
      const msgs = (window as unknown as Record<string, unknown>)['__TEST_HOOK_MESSAGES__'] as
        | Array<{ type: string }>
        | undefined
      return msgs && msgs.some((m) => m.type === 'cqrs-devtools-client-detected')
    })

    // Activate the hook (simulates content script sending activate message)
    await page.evaluate(() => {
      window.postMessage({ type: 'cqrs-devtools-activate', source: 'cqrs-content' }, '*')
    })

    // Perform an action to generate events
    await page.getByPlaceholder('What needs to be done?').fill('Test todo')
    await page.getByRole('button', { name: 'Add' }).click()

    // Wait for event messages to appear
    await page.waitForFunction(() => {
      const msgs = (window as unknown as Record<string, unknown>)['__TEST_HOOK_MESSAGES__'] as
        | Array<{ type: string }>
        | undefined
      return msgs && msgs.some((m) => m.type === 'cqrs-devtools-event')
    })

    const messages = await getCapturedMessages(page)
    const events = messages.filter((m) => m.type === 'cqrs-devtools-event')
    expect(events.length).toBeGreaterThan(0)
  })

  test('no traffic when inactive', async ({ extensionPage: page }) => {
    await page.addInitScript(CAPTURE_HOOK_MESSAGES)
    await page.goto(APP_URL)

    // Wait for client to register
    await page.waitForFunction(() => {
      const msgs = (window as unknown as Record<string, unknown>)['__TEST_HOOK_MESSAGES__'] as
        | Array<{ type: string }>
        | undefined
      return msgs && msgs.some((m) => m.type === 'cqrs-devtools-client-detected')
    })

    // Do NOT activate — perform an action
    await page.getByPlaceholder('What needs to be done?').fill('Inactive test')
    await page.getByRole('button', { name: 'Add' }).click()

    // Wait a moment for any messages that might appear
    await page.waitForTimeout(500)

    const messages = await getCapturedMessages(page)
    const events = messages.filter((m) => m.type === 'cqrs-devtools-event')
    expect(events.length).toBe(0)
  })

  test('command snapshot on activation', async ({ extensionPage: page }) => {
    await page.addInitScript(CAPTURE_HOOK_MESSAGES)
    await page.goto(APP_URL)

    // Wait for client to register
    await page.waitForFunction(() => {
      const msgs = (window as unknown as Record<string, unknown>)['__TEST_HOOK_MESSAGES__'] as
        | Array<{ type: string }>
        | undefined
      return msgs && msgs.some((m) => m.type === 'cqrs-devtools-client-detected')
    })

    // Activate the hook
    await page.evaluate(() => {
      window.postMessage({ type: 'cqrs-devtools-activate', source: 'cqrs-content' }, '*')
    })

    // Wait for command snapshot
    await page.waitForFunction(() => {
      const msgs = (window as unknown as Record<string, unknown>)['__TEST_HOOK_MESSAGES__'] as
        | Array<{ type: string }>
        | undefined
      return msgs && msgs.some((m) => m.type === 'cqrs-devtools-command-snapshot')
    })

    const messages = await getCapturedMessages(page)
    const snapshot = messages.find((m) => m.type === 'cqrs-devtools-command-snapshot')
    expect(snapshot).toBeDefined()
    expect(Array.isArray(snapshot!.commands)).toBe(true)
  })
})
