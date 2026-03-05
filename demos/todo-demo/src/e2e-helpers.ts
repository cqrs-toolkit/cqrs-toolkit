import { expect, type Page } from '@playwright/test'

/**
 * Assert the client started in the expected execution mode.
 * Checks the mode badge rendered in the DOM (which shows `client.mode`).
 */
export async function assertMode(page: Page, expected: string): Promise<void> {
  await expect(page.locator('.mode-badge')).toContainText(`mode: ${expected}`)
}

export async function addTodo(page: Page, text: string): Promise<void> {
  await page.getByPlaceholder('What needs to be done?').fill(text)
  await page.getByRole('button', { name: 'Add' }).click()
}

export async function waitForTodoCount(page: Page, count: number): Promise<void> {
  await expect(page.locator('.todo-item')).toHaveCount(count)
}

export async function getTodoTexts(page: Page): Promise<string[]> {
  return page.locator('.todo-content').allTextContents()
}

export async function waitForTodoContent(page: Page, text: string): Promise<void> {
  await expect(page.locator('.todo-content', { hasText: text })).toBeVisible()
}

export async function addNote(page: Page, title: string, body?: string): Promise<void> {
  await page.getByPlaceholder('Note title').fill(title)
  if (body) {
    await page.getByPlaceholder('Body (optional)').fill(body)
  }
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.locator('.note-title', { hasText: title })).toBeVisible()
}

export async function deleteNote(page: Page, title: string): Promise<void> {
  const item = page.locator('.note-item', { has: page.locator('.note-title', { hasText: title }) })
  await item.getByRole('button', { name: 'Del' }).click()
  await expect(item).toHaveCount(0)
}

export async function waitForNoteCount(page: Page, count: number): Promise<void> {
  await expect(page.locator('.note-item')).toHaveCount(count)
}

export async function waitForDashNotesReady(page: Page): Promise<void> {
  await expect(page.locator('.dash-notes-ready')).toBeVisible()
}

export async function waitForDashTodosReady(page: Page): Promise<void> {
  await expect(page.locator('.dash-todos-ready')).toBeVisible()
}

export async function getDashNoteTexts(page: Page): Promise<string[]> {
  await waitForDashNotesReady(page)
  return page.locator('.dash-note-title').allTextContents()
}

export async function waitForDashNoteCount(page: Page, count: number): Promise<void> {
  await waitForDashNotesReady(page)
  await expect(page.locator('.dash-note-item')).toHaveCount(count)
}

export async function waitForDashNoteAbsent(page: Page, title: string): Promise<void> {
  await waitForDashNotesReady(page)
  await expect(page.locator('.dash-note-title', { hasText: title })).toHaveCount(0)
}

/**
 * Navigate to `url` and wait for the WebSocket `subscribed` ack from the server.
 *
 * Attaches a WebSocket frame listener **before** navigation so the subscription
 * handshake is captured even if it completes before `page.goto()` resolves.
 */
export async function gotoWithWsSubscribed(page: Page, url: string): Promise<void> {
  const subscribedPromise = new Promise<void>((resolve) => {
    page.on('websocket', (ws) => {
      ws.on('framereceived', (frame) => {
        if (typeof frame.payload === 'string' && frame.payload.includes('"subscribed"')) {
          resolve()
        }
      })
    })
  })

  await page.goto(url)
  await subscribedPromise
}

/**
 * Wait for a **new** WebSocket connection to receive the `subscribed` ack.
 *
 * Must be called **before** the action that triggers reconnection (e.g.,
 * `page.context().setOffline(false)`) so the listener is in place when the
 * browser opens the new WebSocket.
 */
export function waitForWsReconnection(page: Page): Promise<void> {
  return new Promise<void>((resolve) => {
    page.on('websocket', (ws) => {
      ws.on('framereceived', (frame) => {
        if (typeof frame.payload === 'string' && frame.payload.includes('"subscribed"')) {
          resolve()
        }
      })
    })
  })
}
