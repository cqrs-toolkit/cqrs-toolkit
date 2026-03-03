import { expect, test } from '@playwright/test'
import { addTodo, getTodoTexts, waitForTodoCount } from '../../e2e-helpers'

const TODOS_URL = '/todos?mode=online-only&ws=false'

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3001/api/test/reset')
})

test('shows empty state initially', async ({ page }) => {
  await page.goto(TODOS_URL)
  await expect(page.locator('.empty-state')).toContainText('No todos yet')
})

test('creates a todo', async ({ page }) => {
  await page.goto(TODOS_URL)
  await addTodo(page, 'Buy milk')
  await waitForTodoCount(page, 1)
  const texts = await getTodoTexts(page)
  expect(texts).toContain('Buy milk')
})

test('creates multiple todos', async ({ page }) => {
  await page.goto(TODOS_URL)
  await addTodo(page, 'First task')
  await waitForTodoCount(page, 1)
  await addTodo(page, 'Second task')
  await waitForTodoCount(page, 2)
  const texts = await getTodoTexts(page)
  expect(texts).toEqual(['First task', 'Second task'])
})

test('edits a todo', async ({ page }) => {
  await page.goto(TODOS_URL)
  await addTodo(page, 'Original text')
  await waitForTodoCount(page, 1)

  await page.locator('.todo-item').first().getByRole('button', { name: 'Edit' }).click()
  const editInput = page.locator('.edit-input')
  await editInput.fill('Updated text')
  await editInput.press('Enter')

  await expect(page.locator('.todo-content').first()).toHaveText('Updated text')
})

test('toggles todo status', async ({ page }) => {
  await page.goto(TODOS_URL)
  await addTodo(page, 'Toggle me')
  await waitForTodoCount(page, 1)

  const checkbox = page.locator('.todo-item').first().locator('input[type="checkbox"]')

  // pending → in_progress
  await checkbox.click()
  // in_progress → completed
  await checkbox.click()

  await expect(page.locator('.todo-item.completed')).toBeVisible()
})

test('deletes a todo', async ({ page }) => {
  await page.goto(TODOS_URL)
  await addTodo(page, 'Delete me')
  await waitForTodoCount(page, 1)

  await page.locator('.todo-item').first().getByRole('button', { name: 'Del' }).click()
  await waitForTodoCount(page, 0)
  await expect(page.locator('.empty-state')).toContainText('No todos yet')
})

test('shows mode badge', async ({ page }) => {
  await page.goto(TODOS_URL)
  await expect(page.locator('.mode-badge')).toContainText('online-only')
})
