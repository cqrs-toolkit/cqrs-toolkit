import {
  addNote,
  addNotebook,
  deleteNote,
  waitForNoteCount,
} from '@cqrs-toolkit/hypermedia-base/e2e-helpers'
import { test } from '../e2e-fixtures.js'

test('creates a notebook with notes', async ({ page }) => {
  await page.locator('a[href="/notes"]').click()
  await addNotebook(page, 'Work')
  await addNote(page, 'Meeting notes', 'Discuss roadmap')
  await waitForNoteCount(page, 1)
})

test('deletes a note', async ({ page }) => {
  await page.locator('a[href="/notes"]').click()
  await addNotebook(page, 'Personal')
  await addNote(page, 'Grocery list')
  await waitForNoteCount(page, 1)

  await deleteNote(page, 'Grocery list')
  await waitForNoteCount(page, 0)
})
