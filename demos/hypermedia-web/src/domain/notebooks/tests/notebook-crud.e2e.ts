import { addNotebook } from '@cqrs-toolkit/hypermedia-base/e2e-helpers'
import { expect, test, url } from '../../../e2e-fixtures.js'

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3002/api/test/reset')
})

test('creating a notebook auto-selects it', async ({ page, mode }) => {
  await page.goto(url('/notes', { mode, ws: false }))

  await addNotebook(page, 'My Notebook')

  // The newly created notebook should be selected (has .notebook-selected class)
  await expect(
    page.locator('.notebook-item.notebook-selected', {
      has: page.locator('.notebook-name', { hasText: 'My Notebook' }),
    }),
  ).toBeVisible()

  // The middle column should show the notes panel (not "Select a notebook")
  await expect(page.locator('.add-note-btn')).toBeVisible()
})

test('creating a second notebook auto-selects it and deselects the first', async ({
  page,
  mode,
}) => {
  await page.goto(url('/notes', { mode, ws: false }))

  await addNotebook(page, 'First')
  await addNotebook(page, 'Second')

  // Second notebook should be selected
  await expect(
    page.locator('.notebook-item.notebook-selected', {
      has: page.locator('.notebook-name', { hasText: 'Second' }),
    }),
  ).toBeVisible()

  // First should not be selected
  await expect(
    page.locator('.notebook-item.notebook-selected', {
      has: page.locator('.notebook-name', { hasText: 'First' }),
    }),
  ).not.toBeAttached()
})
