import {
  addTodo,
  waitForTodoContent,
  waitForTodoCount,
} from '@cqrs-toolkit/hypermedia-base/e2e-helpers'
import { test } from '../e2e-fixtures.js'

test('data persists across app restart', async ({ electronApp, page }) => {
  // Create a todo
  await page.locator('a[href="/todos"]').click()
  await addTodo(page, 'Persistent todo')
  await waitForTodoCount(page, 1)

  // Close and relaunch the app
  await electronApp.close()

  const { _electron: electron2 } = await import('@playwright/test')
  const { dirname, join } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const testDir = dirname(fileURLToPath(import.meta.url))
  const app2 = await electron2.launch({
    args: [join(testDir, '..', '..', 'dist', 'main.js')],
  })
  const page2 = await app2.firstWindow()

  try {
    // Navigate to todos and verify the data survived
    await page2.locator('a[href="/todos"]').click()
    await waitForTodoContent(page2, 'Persistent todo')
  } finally {
    await app2.close()
  }
})
