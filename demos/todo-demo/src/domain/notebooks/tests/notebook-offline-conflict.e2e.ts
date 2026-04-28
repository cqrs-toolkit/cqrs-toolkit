import { expect, setupTestDiagnostics, test, url } from '#e2e-fixtures'
import {
  addNote,
  addNotebook,
  deleteNotebook,
  gotoWithWsSubscribed,
  renameNotebook,
  selectNote,
  selectNotebook,
  waitForWsDisconnected,
  waitForWsReconnection,
} from '../../../e2e-helpers.js'

setupTestDiagnostics()

const API = 'http://localhost:3001/api'

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3001/api/test/reset')
  await request.post('http://localhost:3001/api/test/ws-resume')
})

test('last-writer-wins: server note edit beats offline edit on reconnect', async ({
  page,
  browser,
  mode,
  request,
}) => {
  test.skip(mode === 'online-only', 'Requires worker-backed offline command queue')

  const context2 = await browser.newContext()
  try {
    const pageB = await context2.newPage()

    await gotoWithWsSubscribed(pageB, url('/notes', { mode, ws: true, session: 'b' }))
    await gotoWithWsSubscribed(page, url('/notes', { mode, ws: true }))

    // Create shared notebook and wait for pageB to see it
    await addNotebook(page, 'Shared Notebook')
    await expect(pageB.locator('.notebook-name', { hasText: 'Shared Notebook' })).toBeVisible()

    // Create a note in the shared notebook; wait for pageB to see it
    await selectNotebook(pageB, 'Shared Notebook')
    await addNote(page, 'Online Note')
    await expect(pageB.locator('.note-title', { hasText: 'Online Note' })).toBeVisible()

    // pageA goes offline
    await request.post(`${API}/test/ws-pause`)
    await waitForWsDisconnected(page)
    await page.context().setOffline(true)

    // pageA edits the note while offline
    await selectNote(page, 'Online Note')
    await expect(page.locator('.note-editor.editor-ready')).toBeVisible()
    await page.locator('.editor-title').fill('Online Note - Edited Offline')
    await page.locator('.save-note').click()
    await expect(
      page.locator('.note-title', { hasText: 'Online Note - Edited Offline' }),
    ).toBeVisible()

    // pageB edits the same note online — server accepts this version
    await selectNote(pageB, 'Online Note')
    await expect(pageB.locator('.note-editor.editor-ready')).toBeVisible()
    await pageB.locator('.editor-title').fill('Online Note - Edited Online')
    await pageB.locator('.save-note').click()
    await expect(
      pageB.locator('.note-title', { hasText: 'Online Note - Edited Online' }),
    ).toBeVisible()

    // pageA reconnects — offline command fails due to revision conflict
    await request.post(`${API}/test/ws-resume`)
    await page.context().setOffline(false)
    await waitForWsReconnection(page)
    await page.waitForTimeout(500)

    // Both browsers should reflect the server-accepted edit
    await expect(
      page.locator('.note-title', { hasText: 'Online Note - Edited Online' }),
    ).toBeVisible({ timeout: 8_000 })
    await expect(
      page.locator('.note-title', { hasText: 'Online Note - Edited Offline' }),
    ).toHaveCount(0)
    await expect(
      pageB.locator('.note-title', { hasText: 'Online Note - Edited Online' }),
    ).toBeVisible()
  } finally {
    await context2.close()
  }
})


test('notes panel closes when the selected notebook is deleted', async ({ page, mode }) => {
  await page.goto(url('/notes', { mode, ws: false }))

  await addNotebook(page, 'Doomed Notebook')
  await expect(page.locator('.add-note-btn')).toBeVisible()

  await deleteNotebook(page, 'Doomed Notebook')

  await expect(page.locator('.add-note-btn')).not.toBeAttached()
})

test('offline-created notebook syncs to all clients on reconnect', async ({
  page,
  browser,
  mode,
  request,
}) => {
  test.skip(mode === 'online-only', 'Requires worker-backed offline command queue')

  const context2 = await browser.newContext()
  try {
    const pageB = await context2.newPage()

    await gotoWithWsSubscribed(pageB, url('/notes', { mode, ws: true, session: 'b' }))
    await gotoWithWsSubscribed(page, url('/notes', { mode, ws: true }))

    // pageA goes offline before creating anything
    await request.post(`${API}/test/ws-pause`)
    await waitForWsDisconnected(page)
    await page.context().setOffline(true)

    // pageA creates a notebook offline
    await addNotebook(page, 'Offline Notebook')

    // pageB creates a notebook online
    await addNotebook(pageB, 'Online Notebook')
    await expect(pageB.locator('.notebook-name', { hasText: 'Online Notebook' })).toBeVisible()

    // pageA reconnects
    await request.post(`${API}/test/ws-resume`)
    await page.context().setOffline(false)
    await waitForWsReconnection(page)
    await page.waitForTimeout(500)

    // Both clients should have both notebooks
    await expect(
      page.locator('.notebook-name', { hasText: 'Offline Notebook' }),
    ).toBeVisible({ timeout: 8_000 })
    await expect(
      page.locator('.notebook-name', { hasText: 'Online Notebook' }),
    ).toBeVisible({ timeout: 8_000 })

    await expect(
      pageB.locator('.notebook-name', { hasText: 'Offline Notebook' }),
    ).toBeVisible({ timeout: 8_000 })
    await expect(pageB.locator('.notebook-name', { hasText: 'Online Notebook' })).toBeVisible()
  } finally {
    await context2.close()
  }
})

test('server rename wins over concurrent offline rename on reconnect', async ({
  page,
  browser,
  mode,
  request,
}) => {
  test.skip(mode === 'online-only', 'Requires worker-backed offline command queue')

  const context2 = await browser.newContext()
  try {
    const pageB = await context2.newPage()

    await gotoWithWsSubscribed(pageB, url('/notes', { mode, ws: true, session: 'b' }))
    await gotoWithWsSubscribed(page, url('/notes', { mode, ws: true }))

    // Create shared notebook; wait for pageB to see it
    await addNotebook(page, 'Shared Notebook')
    await expect(pageB.locator('.notebook-name', { hasText: 'Shared Notebook' })).toBeVisible()

    // pageA goes offline
    await request.post(`${API}/test/ws-pause`)
    await waitForWsDisconnected(page)
    await page.context().setOffline(true)

    await renameNotebook(page, 'Shared Notebook', 'Shared Notebook Offline Edit')

    await renameNotebook(pageB, 'Shared Notebook', 'Shared Notebook Online Edit')
    await expect(
      pageB.locator('.notebook-name', { hasText: 'Shared Notebook Online Edit' }),
    ).toBeVisible()

    // pageA reconnects — offline rename rejected due to revision conflict
    await request.post(`${API}/test/ws-resume`)
    await page.context().setOffline(false)
    await waitForWsReconnection(page)
    await page.waitForTimeout(500)

    // Both clients should show the server-accepted name
    await expect(
      page.locator('.notebook-name', { hasText: 'Shared Notebook Online Edit' }),
    ).toBeVisible({ timeout: 8_000 })
    await expect(
      page.locator('.notebook-name', { hasText: 'Shared Notebook Offline Edit' }),
    ).toHaveCount(0)
    await expect(
      pageB.locator('.notebook-name', { hasText: 'Shared Notebook Online Edit' }),
    ).toBeVisible()
  } finally {
    await context2.close()
  }
})

test('server delete wins over concurrent offline rename on reconnect', async ({
  page,
  browser,
  mode,
  request,
}) => {
  test.skip(mode === 'online-only', 'Requires worker-backed offline command queue')

  const context2 = await browser.newContext()
  try {
    const pageB = await context2.newPage()

    await gotoWithWsSubscribed(pageB, url('/notes', { mode, ws: true, session: 'b' }))
    await gotoWithWsSubscribed(page, url('/notes', { mode, ws: true }))

    // Create shared notebook; wait for pageB to see it
    await addNotebook(page, 'Shared Notebook')
    await expect(pageB.locator('.notebook-name', { hasText: 'Shared Notebook' })).toBeVisible()

    // pageA goes offline
    await request.post(`${API}/test/ws-pause`)
    await waitForWsDisconnected(page)
    await page.context().setOffline(true)

    // pageA renames offline
    await renameNotebook(page, 'Shared Notebook', 'Shared Notebook Offline Edit')

    // pageB deletes the notebook online — server processes the delete
    await deleteNotebook(pageB, 'Shared Notebook')
    await expect(pageB.locator('.notebook-item')).toHaveCount(0)

    // pageA reconnects — offline rename rejected; delete event arrives via gap repair
    await request.post(`${API}/test/ws-resume`)
    await page.context().setOffline(false)
    await waitForWsReconnection(page)
    await page.waitForTimeout(500)

    // Both clients should have no notebooks
    await expect(page.locator('.notebook-item')).toHaveCount(0, { timeout: 8_000 })
    await expect(pageB.locator('.notebook-item')).toHaveCount(0)
  } finally {
    await context2.close()
  }
})
