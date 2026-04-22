import { expect, setupTestDiagnostics, test, url } from '#e2e-fixtures'
import { addTodo, getTodoTexts, waitForTodoCount } from '../../../e2e-helpers.js'

setupTestDiagnostics()

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3001/api/test/reset')
})

test('shows empty state initially', async ({ page, mode }) => {
  await page.goto(url('/todos', { mode, ws: false }))
  await expect(page.locator('.empty-state')).toContainText('No todos yet')
})

test('creates a todo', async ({ page, mode }) => {
  await page.goto(url('/todos', { mode, ws: false }))
  await addTodo(page, 'Buy milk')
  await waitForTodoCount(page, 1)
  const texts = await getTodoTexts(page)
  expect(texts).toContain('Buy milk')
})

test('creates multiple todos', async ({ page, mode }) => {
  await page.goto(url('/todos', { mode, ws: false }))
  await addTodo(page, 'First task')
  await waitForTodoCount(page, 1)
  await addTodo(page, 'Second task')
  await waitForTodoCount(page, 2)
  const texts = await getTodoTexts(page)
  expect(texts).toEqual(['Second task', 'First task'])
})

test('edits a todo', async ({ page, mode }) => {
  await page.goto(url('/todos', { mode, ws: false }))
  await addTodo(page, 'Original text')
  await waitForTodoCount(page, 1)

  await page.locator('.todo-item').first().getByRole('button', { name: 'Edit' }).click()
  const editInput = page.locator('.edit-input')
  await editInput.fill('Updated text')
  await editInput.press('Enter')

  await expect(page.locator('.todo-content').first()).toHaveText('Updated text')
})

test('toggles todo status', async ({ page, mode }) => {
  await page.goto(url('/todos', { mode, ws: false }))
  await addTodo(page, 'Toggle me')
  await waitForTodoCount(page, 1)

  const checkbox = page.locator('.todo-item').first().locator('input[type="checkbox"]')
  // pending → in_progress
  await checkbox.click()
  await expect(page.locator('.todo-item.in-progress')).toBeVisible()

  // in_progress → completed
  await checkbox.click()
  await expect(page.locator('.todo-item.completed')).toBeVisible()
})

test('deletes a todo', async ({ page, mode }) => {
  await page.goto(url('/todos', { mode, ws: false }))
  await addTodo(page, 'Delete me')
  await waitForTodoCount(page, 1)

  await page.locator('.todo-item').first().getByRole('button', { name: 'Del' }).click()
  await waitForTodoCount(page, 0)
})
