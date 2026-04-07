import {
  addNote,
  addNotebook,
  deleteAttachment,
  selectNotebook,
  uploadAttachment,
  waitForAttachmentCount,
  waitForNoteCount,
} from '@cqrs-toolkit/hypermedia-base/e2e-helpers'
import { SERVER, expect, test } from '../e2e-fixtures.js'

test('uploads a file and confirms on server', async ({ page, request }) => {
  await page.locator('a[href="/notes"]').click()
  await addNotebook(page, 'Upload NB')
  await selectNotebook(page, 'Upload NB')
  await addNote(page, 'Upload Note', 'body text')
  await waitForNoteCount(page, 1)

  const fileContent = 'hello from electron e2e test'
  await uploadAttachment(page, 'test-file.txt', fileContent)
  await waitForAttachmentCount(page, 1)

  await expect(page.locator('.attachment-name', { hasText: 'test-file.txt' })).toBeVisible()

  // Verify on server — file-objects endpoint should have an entry
  const res = await request.get(`${SERVER}/api/file-objects`, {
    headers: { Accept: 'application/hal+json' },
  })
  expect(res.ok()).toBe(true)
  const body = (await res.json()) as { _embedded: { item: { name: string }[] } }
  expect(body._embedded.item.some((f) => f.name === 'test-file.txt')).toBe(true)
})

test('uploads a real file from disk via file.path', async ({ page, request }) => {
  await page.locator('a[href="/notes"]').click()
  await addNotebook(page, 'Disk Upload NB')
  await selectNotebook(page, 'Disk Upload NB')
  await addNote(page, 'Disk Upload Note', 'body text')
  await waitForNoteCount(page, 1)

  // In Electron, setInputFiles with a real path gives File.path — triggering
  // the path-based transfer (no base64, just sends the path string).
  const { dirname, join } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  // Test fixture: NASA "Pale Blue Dot" (1990), public domain (US govt work, 17 U.S.C. § 105)
  // Source: https://science.nasa.gov/resource/voyager-pale-blue-dot-download/
  //   specifically: https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia23/pia23645/PIA23645.jpg
  const fixture = join(
    dirname(fileURLToPath(import.meta.url)),
    'fixtures',
    'pale_blue_dot_nasa.jpg',
  )

  await page.locator('.attachment-file-input').setInputFiles(fixture)
  await expect(
    page.locator('.attachment-name', { hasText: 'pale_blue_dot_nasa.jpg' }),
  ).toBeVisible()
  await waitForAttachmentCount(page, 1)

  // Verify on server
  const res = await request.get(`${SERVER}/api/file-objects`, {
    headers: { Accept: 'application/hal+json' },
  })
  expect(res.ok()).toBe(true)
  const body = (await res.json()) as { _embedded: { item: { name: string }[] } }
  expect(body._embedded.item.some((f) => f.name === 'pale_blue_dot_nasa.jpg')).toBe(true)
})

test('uploads a file then deletes it', async ({ page }) => {
  await page.locator('a[href="/notes"]').click()
  await addNotebook(page, 'Delete Attach NB')
  await selectNotebook(page, 'Delete Attach NB')
  await addNote(page, 'Delete Attach Note', 'body')
  await waitForNoteCount(page, 1)

  await uploadAttachment(page, 'to-delete.txt', 'delete me')
  await waitForAttachmentCount(page, 1)

  await deleteAttachment(page, 'to-delete.txt')
  await waitForAttachmentCount(page, 0)
})
