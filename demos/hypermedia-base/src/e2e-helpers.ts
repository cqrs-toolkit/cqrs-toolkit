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

// ---------------------------------------------------------------------------
// Notebook helpers
// ---------------------------------------------------------------------------

export async function addNotebook(page: Page, name: string): Promise<void> {
  await page.locator('.add-notebook-btn').click()
  await page.locator('.notebook-placeholder-input').fill(name)
  await page.locator('.save-notebook').click()
  await expect(page.locator('.notebook-placeholder')).not.toBeAttached()
  await expect(page.locator('.notebook-name', { hasText: name })).toBeVisible()
  // Wait for auto-select: the notebook should be selected after create.
  await expect(
    page.locator('.notebook-item.notebook-selected', {
      has: page.locator('.notebook-name', { hasText: name }),
    }),
  ).toBeVisible()
}

export async function selectNotebook(page: Page, name: string): Promise<void> {
  await page
    .locator('.notebook-item', { has: page.locator('.notebook-name', { hasText: name }) })
    .click()
}

export async function renameNotebook(page: Page, oldName: string, newName: string): Promise<void> {
  const item = page.locator('.notebook-item', {
    has: page.locator('.notebook-name', { hasText: oldName }),
  })
  await item.dblclick()
  await expect(item.locator('.rename-input')).toBeVisible()
  await item.locator('.rename-input').fill(newName)
  await item.locator('.rename-input').press('Enter')
  await expect(page.locator('.notebook-name', { hasText: newName })).toBeVisible()
}

export async function deleteNotebook(page: Page, name: string): Promise<void> {
  // Ensure trash icons are visible
  if (
    !(await page
      .locator('.delete-notebook')
      .first()
      .isVisible()
      .catch(() => false))
  ) {
    await page.locator('.toggle-trash').click()
  }
  const item = page.locator('.notebook-item', {
    has: page.locator('.notebook-name', { hasText: name }),
  })
  await item.locator('.delete-notebook').click()
  await expect(item).toHaveCount(0)
}

// ---------------------------------------------------------------------------
// Note helpers (new 3-column UI)
// ---------------------------------------------------------------------------

/**
 * Add a note in the currently selected notebook using the 3-column UI.
 * Clicks `+`, fills title/body in the editor, clicks save, then waits for the
 * note to appear in the title list.
 */
export async function addNote(page: Page, title: string, body?: string): Promise<void> {
  // Click the + button to create a placeholder
  await page.locator('.add-note-btn').click()
  // Wait for editor to appear in create mode
  await expect(page.locator('.note-editor.editor-create')).toBeVisible()

  // Fill the editor
  await page.locator('.editor-title').fill(title)
  if (body) {
    await page.locator('.editor-body').fill(body)
  }

  // Click save
  await page.locator('.save-note').click()

  // Wait for the note to appear in the title list (as a non-italic, persisted item)
  await expect(
    page.locator('.note-title-item .note-title:not(.italic)', { hasText: title }),
  ).toBeVisible()

  // Wait for the save cycle to complete. After create-mode save, the editor
  // transitions from editor-create → editor-saving → editor-ready (item query
  // loaded the newly created note).
  await expect(page.locator('.note-editor.editor-saving')).not.toBeAttached()
  await expect(page.locator('.note-editor.editor-ready')).toBeVisible()
}

/**
 * Add a note in a specific notebook. Selects the notebook first.
 */
export async function addNoteInNotebook(
  page: Page,
  notebookName: string,
  title: string,
  body?: string,
): Promise<void> {
  await selectNotebook(page, notebookName)
  await addNote(page, title, body)
}

/**
 * Select a note by title in the middle column title list.
 */
export async function selectNote(page: Page, title: string): Promise<void> {
  await page
    .locator('.note-title-item', { has: page.locator('.note-title', { hasText: title }) })
    .click()
}

/**
 * Delete the currently selected note via the editor's trash button.
 * Waits for the item query to load the selected note's data before clicking delete,
 * eliminating races between note selection and stale query data.
 */
export async function deleteNote(page: Page, title: string): Promise<void> {
  await selectNote(page, title)
  // Wait for the editor to finish loading the selected note's data
  await expect(page.locator('.note-editor.editor-ready')).toBeVisible()
  await page.locator('.delete-note').click()
  // Wait for the note to disappear from the title list
  await expect(page.locator('.note-title-item .note-title', { hasText: title })).toHaveCount(0)
}

export async function waitForNoteCount(page: Page, count: number): Promise<void> {
  // Count non-placeholder note title items (those without italic class)
  await expect(page.locator('.note-title-item:not(:has(.italic))')).toHaveCount(count)
}

export async function waitForDashNotebooksReady(page: Page): Promise<void> {
  await expect(page.locator('.dash-notebooks-ready')).toBeVisible()
}

export async function waitForDashTodosReady(page: Page): Promise<void> {
  await expect(page.locator('.dash-todos-ready')).toBeVisible()
}

export async function getDashNotebookTexts(page: Page): Promise<string[]> {
  await waitForDashNotebooksReady(page)
  return page.locator('.dash-notebook-name').allTextContents()
}

export async function waitForDashNotebookCount(page: Page, count: number): Promise<void> {
  await waitForDashNotebooksReady(page)
  await expect(page.locator('.dash-notebook-item')).toHaveCount(count)
}

export async function waitForDashNotebookAbsent(page: Page, name: string): Promise<void> {
  await waitForDashNotebooksReady(page)
  await expect(page.locator('.dash-notebook-name', { hasText: name })).toHaveCount(0)
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

/**
 * Clear the in-page CQRS event log.
 * Useful before a test phase so the dump on failure only shows relevant events.
 */
export async function clearCqrsEventLog(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__CQRS_EVENTS__ = []
  })
}

// ---------------------------------------------------------------------------
// Attachment helpers
// ---------------------------------------------------------------------------

export async function uploadAttachment(
  page: Page,
  filename: string,
  content: string,
): Promise<void> {
  const buffer = Buffer.from(content)
  await page.locator('.attachment-file-input').setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer,
  })
  await expect(page.locator('.attachment-name', { hasText: filename })).toBeVisible()
}

export async function waitForAttachmentCount(page: Page, count: number): Promise<void> {
  await expect(page.locator('.attachment-item')).toHaveCount(count)
}

export async function deleteAttachment(page: Page, filename: string): Promise<void> {
  const item = page.locator('.attachment-item', {
    has: page.locator('.attachment-name', { hasText: filename }),
  })
  await item.locator('.delete-attachment').click()
  await expect(
    page.locator('.attachment-item', {
      has: page.locator('.attachment-name', { hasText: filename }),
    }),
  ).toHaveCount(0)
}
