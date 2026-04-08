import {
  addTodo,
  waitForTodoContent,
  waitForTodoCount,
} from '@cqrs-toolkit/hypermedia-base/e2e-helpers'
import { test } from '../e2e-fixtures.js'

test('data persists across app restart', async ({ electronApp, page, launchApp }) => {
  // Create a todo
  await page.locator('a[href="/todos"]').click()
  await addTodo(page, 'Persistent todo')
  await waitForTodoCount(page, 1)

  // Close and relaunch the app (same userDataDir)
  await electronApp.close()
  const app2 = await launchApp()
  const page2 = await app2.firstWindow()

  // Navigate to todos and verify the data survived
  await page2.locator('a[href="/todos"]').click()
  await waitForTodoContent(page2, 'Persistent todo')
})
