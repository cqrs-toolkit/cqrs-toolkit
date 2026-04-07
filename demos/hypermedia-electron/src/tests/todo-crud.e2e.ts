import { addTodo, getTodoTexts, waitForTodoCount } from '@cqrs-toolkit/hypermedia-base/e2e-helpers'
import { SERVER, expect, test } from '../e2e-fixtures.js'

test('creates a todo and confirms on server', async ({ page, request }) => {
  await page.locator('a[href="/todos"]').click()
  await addTodo(page, 'Buy milk')
  await waitForTodoCount(page, 1)

  // Verify in UI
  const texts = await getTodoTexts(page)
  expect(texts).toContain('Buy milk')

  // Verify on server
  const serverTodos = await getServerTodos(request)
  expect(serverTodos.some((t) => t.content === 'Buy milk')).toBe(true)
})

test('creates multiple todos and confirms on server', async ({ page, request }) => {
  await page.locator('a[href="/todos"]').click()
  await addTodo(page, 'First task')
  await waitForTodoCount(page, 1)
  await addTodo(page, 'Second task')
  await waitForTodoCount(page, 2)

  // Verify in UI
  const texts = await getTodoTexts(page)
  expect(texts).toEqual(['Second task', 'First task'])

  // Verify on server
  const serverTodos = await getServerTodos(request)
  expect(serverTodos).toHaveLength(2)
  expect(serverTodos.some((t) => t.content === 'First task')).toBe(true)
  expect(serverTodos.some((t) => t.content === 'Second task')).toBe(true)
})

test('edits a todo', async ({ page }) => {
  await page.locator('a[href="/todos"]').click()
  await addTodo(page, 'Original text')
  await waitForTodoCount(page, 1)

  await page.locator('.todo-item').first().getByRole('button', { name: 'Edit' }).click()
  const editInput = page.locator('.edit-input')
  await editInput.fill('Updated text')
  await editInput.press('Enter')

  await expect(page.locator('.todo-content').first()).toHaveText('Updated text')
})

test('deletes a todo', async ({ page }) => {
  await page.locator('a[href="/todos"]').click()
  await addTodo(page, 'Delete me')
  await waitForTodoCount(page, 1)

  await page.locator('.todo-item').first().getByRole('button', { name: 'Del' }).click()
  await waitForTodoCount(page, 0)
})

async function getServerTodos(
  request: import('@playwright/test').APIRequestContext,
): Promise<{ content: string }[]> {
  const res = await request.get(`${SERVER}/api/todos`, {
    headers: { Accept: 'application/hal+json' },
  })
  expect(res.ok()).toBe(true)
  const body = (await res.json()) as { _embedded: { item: { content: string }[] } }
  return body._embedded.item
}
