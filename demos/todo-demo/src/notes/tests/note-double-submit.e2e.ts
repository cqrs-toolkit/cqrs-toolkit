import { expect, test, url } from '../../e2e-fixtures.js'
import { addNote, waitForNoteCount } from '../../e2e-helpers.js'
import { testNavigator } from '../../e2e-nav.js'

const { Dashboard, Notes } = testNavigator

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3001/api/test/reset')
})

test('deleting a note produces exactly one delete command', async ({ page, mode }) => {
  await page.goto(url('/notes', { mode, ws: false }))

  await addNote(page, 'Delete me')
  await waitForNoteCount(page, 1)

  // Click Del button
  await page.locator('.note-item').first().getByRole('button', { name: 'Del' }).click()
  await waitForNoteCount(page, 0)

  await Notes.goToDashboard(page)
  await Dashboard.goToCommands(page)

  await expect(page.locator('.command-item')).toHaveCount(2)
  await expect(page.locator('.command-item.command-succeeded')).toHaveCount(2)
  const types = await page
    .locator('.command-item.command-succeeded .command-type')
    .allTextContents()
  expect(types.sort()).toEqual(['CreateNote', 'DeleteNote'])
})

test('editing a note title via Enter does not double-submit', async ({ page, mode }) => {
  await page.goto(url('/notes', { mode, ws: false }))

  await addNote(page, 'Original title')
  await waitForNoteCount(page, 1)

  // Edit via Enter key on title input (triggers handleSave + focusout)
  await page.locator('.note-item').first().getByRole('button', { name: 'Edit' }).click()
  const titleInput = page.locator('input.edit-input')
  await titleInput.fill('Updated title')
  await titleInput.press('Enter')
  await expect(page.locator('.note-title').first()).toHaveText('Updated title')

  await Notes.goToDashboard(page)
  await Dashboard.goToCommands(page)

  await expect(page.locator('.command-item')).toHaveCount(2)
  await expect(page.locator('.command-item.command-succeeded')).toHaveCount(2)
  const types = await page
    .locator('.command-item.command-succeeded .command-type')
    .allTextContents()
  expect(types.sort()).toEqual(['CreateNote', 'UpdateNoteTitle'])
})

test('editing a note title via ArrowDown does not double-submit', async ({ page, mode }) => {
  await page.goto(url('/notes', { mode, ws: false }))

  await addNote(page, 'Arrow title')
  await waitForNoteCount(page, 1)

  // Edit via ArrowDown on title input (triggers handleSave + focusout)
  await page.locator('.note-item').first().getByRole('button', { name: 'Edit' }).click()
  const titleInput = page.locator('input.edit-input')
  await titleInput.fill('Arrow updated')
  await titleInput.press('ArrowDown')
  await expect(page.locator('.note-title').first()).toHaveText('Arrow updated')

  await Notes.goToDashboard(page)
  await Dashboard.goToCommands(page)

  await expect(page.locator('.command-item')).toHaveCount(2)
  await expect(page.locator('.command-item.command-succeeded')).toHaveCount(2)
  const types = await page
    .locator('.command-item.command-succeeded .command-type')
    .allTextContents()
  expect(types.sort()).toEqual(['CreateNote', 'UpdateNoteTitle'])
})

test('editing a note title via blur does not produce extra commands', async ({ page, mode }) => {
  await page.goto(url('/notes', { mode, ws: false }))

  await addNote(page, 'Blur title')
  await waitForNoteCount(page, 1)

  // Edit via blur (click h1 heading to move focus away)
  await page.locator('.note-item').first().getByRole('button', { name: 'Edit' }).click()
  const titleInput = page.locator('input.edit-input')
  await titleInput.fill('Blur updated')
  await page.locator('h1').click()
  await expect(page.locator('.note-title').first()).toHaveText('Blur updated')

  await Notes.goToDashboard(page)
  await Dashboard.goToCommands(page)

  await expect(page.locator('.command-item')).toHaveCount(2)
  await expect(page.locator('.command-item.command-succeeded')).toHaveCount(2)
  const types = await page
    .locator('.command-item.command-succeeded .command-type')
    .allTextContents()
  expect(types.sort()).toEqual(['CreateNote', 'UpdateNoteTitle'])
})

test('editing both note title and body via Enter does not double-submit', async ({
  page,
  mode,
}) => {
  await page.goto(url('/notes', { mode, ws: false }))

  await addNote(page, 'Both title', 'Original body')
  await waitForNoteCount(page, 1)

  // Edit both fields, then press Enter on title input
  await page.locator('.note-item').first().getByRole('button', { name: 'Edit' }).click()
  const titleInput = page.locator('input.edit-input')
  const bodyInput = page.locator('textarea.edit-input')
  await titleInput.fill('New title')
  await bodyInput.fill('New body')
  await titleInput.press('Enter')
  await expect(page.locator('.note-title').first()).toHaveText('New title')

  await Notes.goToDashboard(page)
  await Dashboard.goToCommands(page)

  await expect(page.locator('.command-item')).toHaveCount(3)
  await expect(page.locator('.command-item.command-succeeded')).toHaveCount(3)
  const types = await page
    .locator('.command-item.command-succeeded .command-type')
    .allTextContents()
  expect(types.sort()).toEqual(['CreateNote', 'UpdateNoteBody', 'UpdateNoteTitle'])
})

test('editing only the note body via blur does not produce extra commands', async ({
  page,
  mode,
}) => {
  await page.goto(url('/notes', { mode, ws: false }))

  await addNote(page, 'Body only', 'Original body')
  await waitForNoteCount(page, 1)

  // Edit only body, then blur by clicking h1
  await page.locator('.note-item').first().getByRole('button', { name: 'Edit' }).click()
  const bodyInput = page.locator('textarea.edit-input')
  await bodyInput.fill('Updated body')
  await page.locator('h1').click()
  await expect(page.locator('.note-title').first()).toHaveText('Body only')

  await Notes.goToDashboard(page)
  await Dashboard.goToCommands(page)

  await expect(page.locator('.command-item')).toHaveCount(2)
  await expect(page.locator('.command-item.command-succeeded')).toHaveCount(2)
  const types = await page
    .locator('.command-item.command-succeeded .command-type')
    .allTextContents()
  expect(types.sort()).toEqual(['CreateNote', 'UpdateNoteBody'])
})
