import { expect, type Page } from '@playwright/test'

async function clickAndWaitForHeading(page: Page, linkText: string, headingText: string) {
  await page.locator('a', { hasText: linkText }).click()
  await expect(page.locator('h1', { hasText: headingText })).toBeVisible()
}

export const testNavigator = {
  Dashboard: {
    goToTodos: (page: Page) => clickAndWaitForHeading(page, 'Todos', 'Todos'),
    goToNotes: (page: Page) => clickAndWaitForHeading(page, 'Notes', 'Notes'),
    goToCommands: (page: Page) =>
      clickAndWaitForHeading(page, 'Command Queue Inspector', 'Command Queue'),
  },
  Todos: {
    goToDashboard: (page: Page) => clickAndWaitForHeading(page, 'Back', 'CQRS Client Demo'),
  },
  Notes: {
    goToDashboard: (page: Page) => clickAndWaitForHeading(page, 'Back', 'CQRS Client Demo'),
  },
  Commands: {
    goToDashboard: (page: Page) => clickAndWaitForHeading(page, 'Back', 'CQRS Client Demo'),
  },
}
