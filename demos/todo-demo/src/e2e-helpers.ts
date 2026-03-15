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
  // Wait for the submit to complete — the form transitions from add-saving to add-idle
  // after the server confirms. This ensures the read model has a real server ID and revision.
  await expect(page.locator('.add-form.add-idle')).toBeAttached()
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
  // Wait for the submit to complete — the form transitions from add-saving to add-idle
  // after the server confirms.
  await expect(page.locator('.add-form.add-idle')).toBeAttached()
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
 * Navigate to `url` and wait for the WebSocket `subscribed` state.
 *
 * Works in all execution modes — waits for the `.ws-subscribed` CSS class
 * on the mode badge, which is set when the client receives a ws:subscribed event.
 */
export async function gotoWithWsSubscribed(page: Page, url: string): Promise<void> {
  await page.goto(url)
  await expect(page.locator('.ws-subscribed')).toBeAttached()
}

/**
 * Wait for the WebSocket to disconnect (subscribed state removed).
 *
 * Works in all execution modes — waits for the `.ws-subscribed` CSS class
 * to be removed from the DOM.
 */
export async function waitForWsDisconnected(page: Page): Promise<void> {
  await expect(page.locator('.ws-subscribed')).not.toBeAttached()
}

/**
 * Wait for a WebSocket reconnection to complete (subscribed state).
 *
 * Works in all execution modes — waits for the `.ws-subscribed` CSS class
 * to reappear after a disconnection.
 *
 * @param timeout - defaults to 11s to accommodate the 5s reconnect timer
 */
export async function waitForWsReconnection(page: Page, timeout = 11_000): Promise<void> {
  await expect(page.locator('.ws-subscribed')).toBeAttached({ timeout })
}
