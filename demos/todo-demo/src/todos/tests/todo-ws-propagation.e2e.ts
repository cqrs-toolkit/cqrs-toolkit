import { expect, test, url } from '../../e2e-fixtures'
import {
  addTodo,
  gotoWithWsSubscribed,
  waitForTodoContent,
  waitForTodoCount,
} from '../../e2e-helpers'

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3001/api/test/reset')
})

test('propagates created todo', async ({ page, browser, mode }) => {
  const context2 = await browser.newContext()
  try {
    const pageB = await context2.newPage()

    await gotoWithWsSubscribed(pageB, url('/todos', { mode, ws: true, session: 'b' }))
    await gotoWithWsSubscribed(page, url('/todos', { mode, ws: true }))

    await addTodo(page, 'Propagated todo')
    await waitForTodoCount(page, 1)

    await waitForTodoCount(pageB, 1)
    await waitForTodoContent(pageB, 'Propagated todo')
  } finally {
    await context2.close()
  }
})

test('propagates edited content', async ({ page, browser, mode }) => {
  const context2 = await browser.newContext()
  try {
    const pageB = await context2.newPage()

    await gotoWithWsSubscribed(pageB, url('/todos', { mode, ws: true, session: 'b' }))
    await gotoWithWsSubscribed(page, url('/todos', { mode, ws: true }))

    await addTodo(page, 'Original')
    await waitForTodoCount(page, 1)
    await waitForTodoCount(pageB, 1)

    await page.locator('.todo-item').first().getByRole('button', { name: 'Edit' }).click()
    const editInput = page.locator('.edit-input')
    await editInput.fill('Updated')
    await editInput.press('Enter')

    await expect(page.locator('.todo-content').first()).toHaveText('Updated')
    await waitForTodoContent(pageB, 'Updated')
  } finally {
    await context2.close()
  }
})

test('propagates status change', async ({ page, browser, mode }) => {
  const context2 = await browser.newContext()
  try {
    const pageB = await context2.newPage()

    await gotoWithWsSubscribed(pageB, url('/todos', { mode, ws: true, session: 'b' }))
    await gotoWithWsSubscribed(page, url('/todos', { mode, ws: true }))

    await addTodo(page, 'Toggle me')
    await waitForTodoCount(page, 1)
    await waitForTodoCount(pageB, 1)

    const checkbox = page.locator('.todo-item').first().locator('input[type="checkbox"]')
    // pending → in_progress
    await checkbox.click()
    // in_progress → completed
    await checkbox.click()

    await expect(page.locator('.todo-item.completed')).toBeVisible()
    await expect(pageB.locator('.todo-item.completed')).toBeVisible()
  } finally {
    await context2.close()
  }
})

test('propagates deletion', async ({ page, browser, mode }) => {
  const context2 = await browser.newContext()
  try {
    const pageB = await context2.newPage()

    await gotoWithWsSubscribed(pageB, url('/todos', { mode, ws: true, session: 'b' }))
    await gotoWithWsSubscribed(page, url('/todos', { mode, ws: true }))

    await addTodo(page, 'Delete me')
    await waitForTodoCount(page, 1)
    await waitForTodoCount(pageB, 1)

    await page.locator('.todo-item').first().getByRole('button', { name: 'Del' }).click()
    await waitForTodoCount(page, 0)

    await waitForTodoCount(pageB, 0)
  } finally {
    await context2.close()
  }
})

test('propagates multiple creates', async ({ page, browser, mode }) => {
  const context2 = await browser.newContext()
  try {
    const pageB = await context2.newPage()

    await gotoWithWsSubscribed(pageB, url('/todos', { mode, ws: true, session: 'b' }))
    await gotoWithWsSubscribed(page, url('/todos', { mode, ws: true }))

    await addTodo(page, 'First')
    await waitForTodoCount(page, 1)
    await addTodo(page, 'Second')
    await waitForTodoCount(page, 2)

    await waitForTodoCount(pageB, 2)
    await waitForTodoContent(pageB, 'First')
    await waitForTodoContent(pageB, 'Second')
  } finally {
    await context2.close()
  }
})

test('ping-pong CRUD across sessions', async ({ page, browser, mode }) => {
  const context2 = await browser.newContext()
  try {
    const pageB = await context2.newPage()

    await gotoWithWsSubscribed(pageB, url('/todos', { mode, ws: true, session: 'b' }))
    await gotoWithWsSubscribed(page, url('/todos', { mode, ws: true }))

    // A creates "foo" → B sees it
    await addTodo(page, 'foo')
    await waitForTodoCount(page, 1)
    await waitForTodoCount(pageB, 1)
    await waitForTodoContent(pageB, 'foo')

    // B edits "foo" → "bar" → A sees it
    await pageB.locator('.todo-item').first().getByRole('button', { name: 'Edit' }).click()
    const editInput = pageB.locator('.edit-input')
    await editInput.fill('bar')
    await editInput.press('Enter')
    await expect(pageB.locator('.todo-content').first()).toHaveText('bar')
    await waitForTodoContent(page, 'bar')

    // A deletes "bar" → B sees deletion
    await page.locator('.todo-item').first().getByRole('button', { name: 'Del' }).click()
    await waitForTodoCount(page, 0)
    await waitForTodoCount(pageB, 0)
  } finally {
    await context2.close()
  }
})
