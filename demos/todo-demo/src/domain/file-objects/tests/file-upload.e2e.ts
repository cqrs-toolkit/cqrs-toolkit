import { expect, setupTestDiagnostics, test, url } from '#e2e-fixtures'
import {
  addNote,
  addNotebook,
  deleteAttachment,
  selectNotebook,
  uploadAttachment,
  waitForAttachmentCount,
  waitForNoteCount,
} from '../../../e2e-helpers.js'

setupTestDiagnostics()

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3001/api/test/reset')
})

test('upload a file to a note, download from server and verify content', async ({ page, mode }) => {
  page.on('console', (msg) => {
    if (msg.text().includes('[DEBUG]')) console.log('[PAGE]', msg.text())
  })
  await page.goto(url('/notes', { mode, ws: true }))
  await addNotebook(page, 'Upload NB')
  await selectNotebook(page, 'Upload NB')
  await addNote(page, 'Upload Note', 'body text')
  await waitForNoteCount(page, 1)

  // Upload a file
  const fileContent = 'hello from e2e test'
  await uploadAttachment(page, 'test-file.txt', fileContent)
  await waitForAttachmentCount(page, 1)

  // Wait for server confirmation before downloading
  await expect(page.locator('.attachment-item.attachment-server')).toHaveCount(1)
  await expect(page.locator('.attachment-name', { hasText: 'test-file.txt' })).toBeVisible()

  // Download from server and verify content
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.attachment-name', { hasText: 'test-file.txt' }).click(),
  ])

  const downloadPath = await download.path()
  expect(downloadPath).toBeTruthy()
  if (downloadPath) {
    const { readFileSync } = await import('node:fs')
    const downloaded = readFileSync(downloadPath, 'utf-8')
    expect(downloaded).toBe(fileContent)
  }
})

test.skip('upload a file offline, download from local storage and verify content', async () => {
  // Force offline to ensure command stalls and download must come from local OPFS.
  // Requires implementing the local download path in AttachmentList handleDownload.
})

test('upload a file then delete it', async ({ page, mode }) => {
  await page.goto(url('/notes', { mode, ws: true }))
  await addNotebook(page, 'Delete Attach NB')
  await selectNotebook(page, 'Delete Attach NB')
  await addNote(page, 'Delete Attach Note', 'body')
  await waitForNoteCount(page, 1)

  // Upload a file
  await uploadAttachment(page, 'to-delete.txt', 'delete me')
  await waitForAttachmentCount(page, 1)

  // Delete the attachment
  await deleteAttachment(page, 'to-delete.txt')
  await waitForAttachmentCount(page, 0)
})
