import { expect, test, url } from '../../e2e-fixtures'
import { addTodo, waitForTodoCount } from '../../e2e-helpers'
import { testNavigator } from '../../e2e-nav'

const { Dashboard, Todos } = testNavigator

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3001/api/test/reset')
})

test('editing a todo does not double-submit the update command', async ({ page, mode }) => {
  await page.goto(url('/todos', { mode, ws: false }))

  // Create a todo
  await addTodo(page, 'Original text')
  await waitForTodoCount(page, 1)

  // Edit it via Enter key
  await page.locator('.todo-item').first().getByRole('button', { name: 'Edit' }).click()
  const editInput = page.locator('.edit-input')
  await editInput.fill('Updated text')
  await editInput.press('Enter')
  await expect(page.locator('.todo-content').first()).toHaveText('Updated text')

  // Navigate to command inspector via SPA links (preserves client state)
  await Todos.goToDashboard(page)
  await Dashboard.goToCommands(page)

  // Verify exactly 2 commands exist in total
  await expect(page.locator('.command-item')).toHaveCount(2)

  // Both should be successful
  await expect(page.locator('.command-item.command-succeeded')).toHaveCount(2)

  // Verify the command types are exactly CreateTodo + UpdateTodoContent
  const types = await page
    .locator('.command-item.command-succeeded .command-type')
    .allTextContents()
  expect(types.sort()).toEqual(['CreateTodo', 'UpdateTodoContent'])
})
