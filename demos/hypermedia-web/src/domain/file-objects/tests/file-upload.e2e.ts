import { expect, setupTestDiagnostics, test, url } from '#e2e-fixtures'
import {
  addNote,
  addNotebook,
  deleteAttachment,
  selectNotebook,
  uploadAttachment,
  waitForAttachmentCount,
  waitForNoteCount,
} from '@cqrs-toolkit/hypermedia-base/e2e-helpers'

setupTestDiagnostics()

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3002/api/test/reset')
})

test('upload a file to a note, download and verify content', async ({ page, mode }) => {
  await page.goto(url('/notes', { mode, ws: true }))
  await addNotebook(page, 'Upload NB')
  await selectNotebook(page, 'Upload NB')
  await addNote(page, 'Upload Note', 'body text')
  await waitForNoteCount(page, 1)

  const fileContent = 'hello from hypermedia e2e test'
  await uploadAttachment(page, 'test-file.txt', fileContent)
  await waitForAttachmentCount(page, 1)

  await expect(page.locator('.attachment-name', { hasText: 'test-file.txt' })).toBeVisible()

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

test('upload a file then delete it', async ({ page, mode }) => {
  await page.goto(url('/notes', { mode, ws: true }))
  await addNotebook(page, 'Delete Attach NB')
  await selectNotebook(page, 'Delete Attach NB')
  await addNote(page, 'Delete Attach Note', 'body')
  await waitForNoteCount(page, 1)

  await uploadAttachment(page, 'to-delete.txt', 'delete me')
  await waitForAttachmentCount(page, 1)

  await deleteAttachment(page, 'to-delete.txt')
  await waitForAttachmentCount(page, 0)
})
