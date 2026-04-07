import { addTodo, waitForTodoCount } from '@cqrs-toolkit/hypermedia-base/e2e-helpers'
import { testNavigator } from '@cqrs-toolkit/hypermedia-base/e2e-nav'
import { expect, test, url } from '../../../e2e-fixtures.js'

const { Dashboard, Todos } = testNavigator

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3002/api/test/reset')
})

test('toggling a todo produces exactly one status command', async ({ page, mode }) => {
  await page.goto(url('/todos', { mode, ws: false }))

  await addTodo(page, 'Toggle me')
  await waitForTodoCount(page, 1)

  // Click checkbox to toggle status
  await page.locator('.todo-item').first().locator('input[type="checkbox"]').click()
  await expect(page.locator('.todo-item.in-progress')).toHaveCount(1)

  await Todos.goToDashboard(page)
  await Dashboard.goToCommands(page)

  await expect(page.locator('.command-item')).toHaveCount(2)
  await expect(page.locator('.command-item.command-succeeded')).toHaveCount(2)
  const types = await page
    .locator('.command-item.command-succeeded .command-type')
    .allTextContents()
  expect(types.sort()).toEqual(['nb.ChangeTodoStatus', 'nb.CreateTodo'])
})

test('deleting a todo produces exactly one delete command', async ({ page, mode }) => {
  await page.goto(url('/todos', { mode, ws: false }))

  await addTodo(page, 'Delete me')
  await waitForTodoCount(page, 1)

  // Click Del button
  await page.locator('.todo-item').first().getByRole('button', { name: 'Del' }).click()
  await waitForTodoCount(page, 0)

  await Todos.goToDashboard(page)
  await Dashboard.goToCommands(page)

  await expect(page.locator('.command-item')).toHaveCount(2)
  await expect(page.locator('.command-item.command-succeeded')).toHaveCount(2)
  const types = await page
    .locator('.command-item.command-succeeded .command-type')
    .allTextContents()
  expect(types.sort()).toEqual(['nb.CreateTodo', 'nb.DeleteTodo'])
})

test('editing a todo via Enter does not double-submit the update command', async ({
  page,
  mode,
}) => {
  await page.goto(url('/todos', { mode, ws: false }))

  await addTodo(page, 'Original text')
  await waitForTodoCount(page, 1)

  // Edit it via Enter key (triggers handleSave, then input becomes disabled causing focusout)
  await page.locator('.todo-item').first().getByRole('button', { name: 'Edit' }).click()
  const editInput = page.locator('.edit-input')
  await editInput.fill('Updated text')
  await editInput.press('Enter')
  await expect(page.locator('.todo-content').first()).toHaveText('Updated text')

  await Todos.goToDashboard(page)
  await Dashboard.goToCommands(page)

  await expect(page.locator('.command-item')).toHaveCount(2)
  await expect(page.locator('.command-item.command-succeeded')).toHaveCount(2)
  const types = await page
    .locator('.command-item.command-succeeded .command-type')
    .allTextContents()
  expect(types.sort()).toEqual(['nb.CreateTodo', 'nb.UpdateTodoContent'])
})

test('editing a todo via ArrowDown does not double-submit', async ({ page, mode }) => {
  await page.goto(url('/todos', { mode, ws: false }))

  await addTodo(page, 'Arrow test')
  await waitForTodoCount(page, 1)

  // Edit via ArrowDown (triggers handleSave + focusout)
  await page.locator('.todo-item').first().getByRole('button', { name: 'Edit' }).click()
  const editInput = page.locator('.edit-input')
  await editInput.fill('Arrow updated')
  await editInput.press('ArrowDown')
  await expect(page.locator('.todo-content').first()).toHaveText('Arrow updated')

  await Todos.goToDashboard(page)
  await Dashboard.goToCommands(page)

  await expect(page.locator('.command-item')).toHaveCount(2)
  await expect(page.locator('.command-item.command-succeeded')).toHaveCount(2)
  const types = await page
    .locator('.command-item.command-succeeded .command-type')
    .allTextContents()
  expect(types.sort()).toEqual(['nb.CreateTodo', 'nb.UpdateTodoContent'])
})

test('editing a todo via blur does not produce extra commands', async ({ page, mode }) => {
  await page.goto(url('/todos', { mode, ws: false }))

  await addTodo(page, 'Blur test')
  await waitForTodoCount(page, 1)

  // Edit via blur (click h1 heading to move focus away)
  await page.locator('.todo-item').first().getByRole('button', { name: 'Edit' }).click()
  const editInput = page.locator('.edit-input')
  await editInput.fill('Blur updated')
  await page.locator('h1').click()
  await expect(page.locator('.todo-content').first()).toHaveText('Blur updated')

  await Todos.goToDashboard(page)
  await Dashboard.goToCommands(page)

  await expect(page.locator('.command-item')).toHaveCount(2)
  await expect(page.locator('.command-item.command-succeeded')).toHaveCount(2)
  const types = await page
    .locator('.command-item.command-succeeded .command-type')
    .allTextContents()
  expect(types.sort()).toEqual(['nb.CreateTodo', 'nb.UpdateTodoContent'])
})
