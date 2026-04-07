import { expect, type Page } from '@playwright/test'

async function clickAndWaitForHeading(page: Page, linkText: string, headingText: string) {
  await page.locator('a', { hasText: linkText }).click()
  await expect(page.locator('h1', { hasText: headingText })).toBeVisible()
}

async function clickAndWaitForSelector(page: Page, linkText: string, selector: string) {
  await page.locator('a', { hasText: linkText }).click()
  await expect(page.locator(selector).first()).toBeVisible()
}

export const testNavigator = {
  Dashboard: {
    goToTodos: (page: Page) => clickAndWaitForHeading(page, 'Todos', 'Todos'),
    goToNotes: (page: Page) => clickAndWaitForSelector(page, 'Notebooks', '.notebook-list'),
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
