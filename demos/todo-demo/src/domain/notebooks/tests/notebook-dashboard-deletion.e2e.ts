import { expect, setupTestDiagnostics, test, url } from '#e2e-fixtures'
import {
  addNotebook,
  addTodo,
  deleteNotebook,
  getDashNotebookTexts,
  gotoWithWsSubscribed,
  waitForDashNotebookAbsent,
  waitForDashNotebookCount,
  waitForDashTodosReady,
} from '../../../e2e-helpers.js'
import { testNavigator } from '../../../e2e-nav.js'

const { Dashboard, Notes } = testNavigator

setupTestDiagnostics()

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3001/api/test/reset')
})

test.describe('same-session (no WS)', () => {
  test('dashboard removes deleted notebooks', async ({ page, mode }) => {
    // Create 8 notebooks
    await page.goto(url('/notes', { mode, ws: false }))
    for (let i = 1; i <= 8; i++) {
      await addNotebook(page, `NB-${i}`)
    }

    // Dashboard sorts in-session writes by `updated_at desc` (most-recent
    // first), distinct from the multi-session pageB path which renders the
    // server's name-asc fetch order.
    await Notes.goToDashboard(page)
    await waitForDashNotebookCount(page, 5)
    expect(await getDashNotebookTexts(page)).toEqual(['NB-8', 'NB-7', 'NB-6', 'NB-5', 'NB-4'])

    // Delete NB-8 (on-dashboard) and NB-6 (on-dashboard)
    await Dashboard.goToNotes(page)
    await deleteNotebook(page, 'NB-8')
    await deleteNotebook(page, 'NB-6')

    // Dashboard: older notebooks rotate in
    await Notes.goToDashboard(page)
    await waitForDashNotebookCount(page, 5)
    expect(await getDashNotebookTexts(page)).toEqual(['NB-7', 'NB-5', 'NB-4', 'NB-3', 'NB-2'])

    // Delete NB-1 (off-dashboard)
    await Dashboard.goToNotes(page)
    await deleteNotebook(page, 'NB-1')

    // Dashboard unchanged — off-dashboard delete doesn't affect display
    await Notes.goToDashboard(page)
    await waitForDashNotebookCount(page, 5)
    expect(await getDashNotebookTexts(page)).toEqual(['NB-7', 'NB-5', 'NB-4', 'NB-3', 'NB-2'])

    // Delete NB-7, NB-5, NB-4, NB-3
    await Dashboard.goToNotes(page)
    await deleteNotebook(page, 'NB-7')
    await deleteNotebook(page, 'NB-5')
    await deleteNotebook(page, 'NB-4')
    await deleteNotebook(page, 'NB-3')

    // Dashboard: only NB-2 remains
    await Notes.goToDashboard(page)
    await waitForDashNotebookCount(page, 1)
    expect(await getDashNotebookTexts(page)).toEqual(['NB-2'])
  })
})

test.describe('same-session (with WS)', () => {
  test('dashboard removes deleted notebooks', async ({ page, mode }) => {
    // Create 8 notebooks
    await page.goto(url('/notes', { mode, ws: true }))
    for (let i = 1; i <= 8; i++) {
      await addNotebook(page, `NB-${i}`)
    }

    // Same-session dashboard is `updated_at desc` (recency-driven).
    await Notes.goToDashboard(page)
    await waitForDashNotebookCount(page, 5)
    expect(await getDashNotebookTexts(page)).toEqual(['NB-8', 'NB-7', 'NB-6', 'NB-5', 'NB-4'])

    // Delete NB-8 and NB-6
    await Dashboard.goToNotes(page)
    await deleteNotebook(page, 'NB-8')
    await deleteNotebook(page, 'NB-6')

    // Dashboard: older notebooks rotate in
    await Notes.goToDashboard(page)
    await waitForDashNotebookCount(page, 5)
    expect(await getDashNotebookTexts(page)).toEqual(['NB-7', 'NB-5', 'NB-4', 'NB-3', 'NB-2'])

    // Delete NB-1 (off-dashboard)
    await Dashboard.goToNotes(page)
    await deleteNotebook(page, 'NB-1')

    // Dashboard unchanged
    await Notes.goToDashboard(page)
    await waitForDashNotebookCount(page, 5)
    expect(await getDashNotebookTexts(page)).toEqual(['NB-7', 'NB-5', 'NB-4', 'NB-3', 'NB-2'])

    // Delete NB-7, NB-5, NB-4, NB-3
    await Dashboard.goToNotes(page)
    await deleteNotebook(page, 'NB-7')
    await deleteNotebook(page, 'NB-5')
    await deleteNotebook(page, 'NB-4')
    await deleteNotebook(page, 'NB-3')

    // Dashboard: only NB-2 remains
    await Notes.goToDashboard(page)
    await waitForDashNotebookCount(page, 1)
    expect(await getDashNotebookTexts(page)).toEqual(['NB-2'])
  })
})

test.describe('multi-session WS', () => {
  test('dashboard reflects deletions and rotates higher-numbered notebooks in', async ({
    page,
    browser,
    mode,
  }) => {
    const context2 = await browser.newContext()
    try {
      const pageB = await context2.newPage()

      // pageA: create 10 notebooks
      await gotoWithWsSubscribed(page, url('/notes', { mode, ws: true }))
      for (let i = 1; i <= 10; i++) {
        await addNotebook(page, `NB-${i}`)
      }

      // pageB: dashboard shows lowest 5 (session B for OPFS isolation)
      await gotoWithWsSubscribed(pageB, url('/', { mode, ws: true, session: 'b' }))
      await waitForDashNotebookCount(pageB, 5)
      expect(await getDashNotebookTexts(pageB)).toEqual(['NB-1', 'NB-2', 'NB-3', 'NB-4', 'NB-5'])

      // Delete NB-8 (off-dashboard) — pageB dashboard stays the same
      await deleteNotebook(page, 'NB-8')
      // Brief wait to ensure WS event propagates — dashboard should stay at 5 with same names
      await page.waitForTimeout(500)
      await waitForDashNotebookCount(pageB, 5)
      expect(await getDashNotebookTexts(pageB)).toEqual(['NB-1', 'NB-2', 'NB-3', 'NB-4', 'NB-5'])

      // Delete NB-2 (on-dashboard) — pageB: NB-6 rotates in.
      // Avoid deleting NB-1 while NB-10 is present: the `deleteNotebook`
      // helper's hasText filter does substring matching, so 'NB-1' resolves
      // to both NB-1 and NB-10.
      await deleteNotebook(page, 'NB-2')
      await waitForDashNotebookAbsent(pageB, 'NB-2')
      await waitForDashNotebookCount(pageB, 5)
      expect(await getDashNotebookTexts(pageB)).toEqual(['NB-1', 'NB-3', 'NB-4', 'NB-5', 'NB-6'])

      // Delete NB-3 and NB-5 (on-dashboard)
      await deleteNotebook(page, 'NB-3')
      await waitForDashNotebookAbsent(pageB, 'NB-3')
      await deleteNotebook(page, 'NB-5')
      await waitForDashNotebookAbsent(pageB, 'NB-5')
      await waitForDashNotebookCount(pageB, 5)
      // NB-8 was deleted earlier, so the rotation skips it: NB-7 then NB-9.
      expect(await getDashNotebookTexts(pageB)).toEqual(['NB-1', 'NB-4', 'NB-6', 'NB-7', 'NB-9'])

      // Delete remaining except NB-1
      await deleteNotebook(page, 'NB-4')
      await waitForDashNotebookAbsent(pageB, 'NB-4')
      await deleteNotebook(page, 'NB-6')
      await waitForDashNotebookAbsent(pageB, 'NB-6')
      await deleteNotebook(page, 'NB-7')
      await waitForDashNotebookAbsent(pageB, 'NB-7')
      await deleteNotebook(page, 'NB-9')
      await waitForDashNotebookAbsent(pageB, 'NB-9')
      await deleteNotebook(page, 'NB-10')
      await waitForDashNotebookAbsent(pageB, 'NB-10')

      await waitForDashNotebookCount(pageB, 1)
      expect(await getDashNotebookTexts(pageB)).toEqual(['NB-1'])
    } finally {
      await context2.close()
    }
  })

  test('notebook deletion does not break subsequent todo propagation', async ({
    page,
    browser,
    mode,
  }) => {
    const context2 = await browser.newContext()
    try {
      const pageB = await context2.newPage()

      // pageA: create 10 notebooks, then delete 2.
      // Avoid deleting NB-1 while NB-10 exists: `deleteNotebook`'s hasText
      // filter is substring-based, so 'NB-1' resolves to both NB-1 and NB-10.
      await gotoWithWsSubscribed(page, url('/notes', { mode, ws: true }))
      for (let i = 1; i <= 10; i++) {
        await addNotebook(page, `NB-${i}`)
      }
      await deleteNotebook(page, 'NB-2')
      await deleteNotebook(page, 'NB-3')

      // pageB: dashboard shows updated notebooks (session B for OPFS isolation)
      await gotoWithWsSubscribed(pageB, url('/', { mode, ws: true, session: 'b' }))
      await waitForDashNotebookCount(pageB, 5)
      expect(await getDashNotebookTexts(pageB)).toEqual(['NB-1', 'NB-4', 'NB-5', 'NB-6', 'NB-7'])

      // pageA: navigate to todos via SPA (WS connection persists)
      await Notes.goToDashboard(page)
      await Dashboard.goToTodos(page)
      await addTodo(page, 'Cross-stream todo')

      // pageB: the new todo appears on dashboard (proves WS still works across streams)
      await waitForDashTodosReady(pageB)
      await expect(pageB.locator('.dash-todo-item', { hasText: 'Cross-stream todo' })).toBeVisible()
    } finally {
      await context2.close()
    }
  })
})
