import { expect, test, url } from '../../../e2e-fixtures.js'
import {
  addTodo,
  waitForDashTodosReady,
  waitForTodoContent,
  waitForTodoCount,
} from '../../../e2e-helpers.js'
import { testNavigator } from '../../../e2e-nav.js'

const { Dashboard, Todos } = testNavigator

test.skip(({ mode }) => mode === 'online-only', 'Session change only applies to worker modes')

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3002/api/test/reset')
})

test('wipes local data on user change and continues working', async ({ page, mode }) => {
  // 1. Create a todo in the initial session
  await page.goto(url('/todos', { mode, ws: false }))
  await addTodo(page, 'Old session todo')
  await waitForTodoCount(page, 1)
  await waitForTodoContent(page, 'Old session todo')

  // 2. Verify it appears on the dashboard
  await Todos.goToDashboard(page)
  await waitForDashTodosReady(page)
  await expect(page.locator('.dash-todo-item')).toHaveCount(1)

  // 3. Force a new user session: clear the cookie so the server assigns a new userId.
  //    The server reset wipes event data so the new session starts clean.
  await page.context().clearCookies()
  await page.request.post('http://localhost:3002/api/test/reset')

  // 4. Reload — main.tsx fetches a new session (new userId), SessionManager detects
  //    the user change and wipes stale local data (OPFS/SQLite).
  await page.goto(url('/', { mode, ws: false }))
  await waitForDashTodosReady(page)

  // 5. Dashboard should be clean — no stale todos from the old session
  await expect(page.locator('.dash-todo-empty')).toBeVisible()

  // 6. Navigate to todos page and create a new todo under the new session
  await Dashboard.goToTodos(page)
  await waitForTodoCount(page, 0)
  await addTodo(page, 'New session todo')
  await waitForTodoCount(page, 1)
  await waitForTodoContent(page, 'New session todo')

  // 7. Verify new todo shows up on the dashboard
  await Todos.goToDashboard(page)
  await waitForDashTodosReady(page)
  await expect(page.locator('.dash-todo-item')).toHaveCount(1)
})
