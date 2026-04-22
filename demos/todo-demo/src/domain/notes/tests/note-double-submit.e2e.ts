import { expect, setupTestDiagnostics, test, url } from '#e2e-fixtures'
import {
  addNote,
  addNotebook,
  clearCqrsEventLog,
  selectNote,
  selectNotebook,
  waitForNoteCount,
} from '../../../e2e-helpers.js'
import { testNavigator } from '../../../e2e-nav.js'

const { Dashboard, Notes } = testNavigator

setupTestDiagnostics()

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3001/api/test/reset')
})

test('deleting a note produces exactly one delete command', async ({ page, mode }) => {
  await page.goto(url('/notes', { mode, ws: false }))
  await addNotebook(page, 'Test NB')
  await selectNotebook(page, 'Test NB')

  await addNote(page, 'Delete me')
  await waitForNoteCount(page, 1)

  // Select the note and click delete in editor
  await selectNote(page, 'Delete me')
  await page.locator('.delete-note').click()
  await waitForNoteCount(page, 0)

  await Notes.goToDashboard(page)
  await Dashboard.goToCommands(page)

  // CreateNotebook + CreateNote + DeleteNote = 3 commands
  await expect(page.locator('.command-item')).toHaveCount(3)
  await expect(page.locator('.command-item.command-confirmed')).toHaveCount(3)
  const types = await page
    .locator('.command-item.command-confirmed .command-type')
    .allTextContents()
  expect(types.sort()).toEqual(['CreateNote', 'CreateNotebook', 'DeleteNote'])
})

test('editing a note title via save button does not double-submit', async ({ page, mode }) => {
  await page.goto(url('/notes', { mode, ws: false }))
  await addNotebook(page, 'Test NB')
  await selectNotebook(page, 'Test NB')

  await addNote(page, 'Original title')
  await waitForNoteCount(page, 1)

  // Select the note, edit title in editor, click save
  await selectNote(page, 'Original title')
  await page.locator('.editor-title').fill('Updated title')
  await page.locator('.save-note').click()

  // Wait for the title to update in the title list
  await expect(page.locator('.note-title', { hasText: 'Updated title' })).toBeVisible()

  await Notes.goToDashboard(page)
  await Dashboard.goToCommands(page)

  // CreateNotebook + CreateNote + UpdateNoteTitle = 3 commands
  await expect(page.locator('.command-item')).toHaveCount(3)
  await expect(page.locator('.command-item.command-confirmed')).toHaveCount(3)
  const types = await page
    .locator('.command-item.command-confirmed .command-type')
    .allTextContents()
  expect(types.sort()).toEqual(['CreateNote', 'CreateNotebook', 'UpdateNoteTitle'])
})

test('editing both note title and body produces exactly two update commands', async ({
  page,
  mode,
}) => {
  await page.goto(url('/notes', { mode, ws: false }))
  await addNotebook(page, 'Test NB')
  await selectNotebook(page, 'Test NB')

  await addNote(page, 'Both title', 'Original body')
  await waitForNoteCount(page, 1)

  // Select the note, edit both fields, click save
  await clearCqrsEventLog(page)
  await selectNote(page, 'Both title')
  await page.locator('.editor-title').fill('New title')
  await page.locator('.editor-body').fill('New body')
  await page.locator('.save-note').click()

  await expect(page.locator('.note-title', { hasText: 'New title' })).toBeVisible()

  await Notes.goToDashboard(page)
  await Dashboard.goToCommands(page)

  // CreateNotebook + CreateNote + UpdateNoteTitle + UpdateNoteBody = 4 commands
  await expect(page.locator('.command-item')).toHaveCount(4)
  await expect(page.locator('.command-item.command-confirmed')).toHaveCount(4)
  const types = await page
    .locator('.command-item.command-confirmed .command-type')
    .allTextContents()
  expect(types.sort()).toEqual([
    'CreateNote',
    'CreateNotebook',
    'UpdateNoteBody',
    'UpdateNoteTitle',
  ])
})

test('editing only the note body produces exactly one update command', async ({ page, mode }) => {
  await page.goto(url('/notes', { mode, ws: false }))
  await addNotebook(page, 'Test NB')
  await selectNotebook(page, 'Test NB')

  await addNote(page, 'Body only', 'Original body')
  await waitForNoteCount(page, 1)

  // Select the note, edit only body, click save
  await selectNote(page, 'Body only')
  await page.locator('.editor-body').fill('Updated body')
  await page.locator('.save-note').click()

  // Title unchanged
  await expect(page.locator('.note-title', { hasText: 'Body only' })).toBeVisible()

  await Notes.goToDashboard(page)
  await Dashboard.goToCommands(page)

  // CreateNotebook + CreateNote + UpdateNoteBody = 3 commands
  await expect(page.locator('.command-item')).toHaveCount(3)
  await expect(page.locator('.command-item.command-confirmed')).toHaveCount(3)
  const types = await page
    .locator('.command-item.command-confirmed .command-type')
    .allTextContents()
  expect(types.sort()).toEqual(['CreateNote', 'CreateNotebook', 'UpdateNoteBody'])
})
