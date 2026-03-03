import { expect, test } from '@playwright/test'
import {
  addNote,
  addTodo,
  deleteNote,
  getDashNoteTexts,
  gotoWithWsSubscribed,
  waitForDashNoteAbsent,
  waitForDashNoteCount,
  waitForDashTodosReady,
  waitForNoteCount,
} from '../../e2e-helpers'

const NOTES_URL_NO_WS = '/notes?mode=online-only&ws=false'
const NOTES_URL = '/notes?mode=online-only&ws=true'
const DASH_URL_NO_WS = '/?mode=online-only&ws=false'
const DASH_URL = '/?mode=online-only&ws=true'
const TODOS_URL = '/todos?mode=online-only&ws=true'

test.beforeEach(async ({ request }) => {
  await request.post('http://localhost:3001/api/test/reset')
})

test.describe('same-session (no WS)', () => {
  test('dashboard removes deleted notes', async ({ page }) => {
    // Create 8 notes
    await page.goto(NOTES_URL_NO_WS)
    for (let i = 1; i <= 8; i++) {
      await addNote(page, `Note-${i}`)
    }
    await waitForNoteCount(page, 8)

    // Dashboard shows 5 most recent (Note-8 through Note-4)
    await page.goto(DASH_URL_NO_WS)
    await waitForDashNoteCount(page, 5)
    expect(await getDashNoteTexts(page)).toEqual(['Note-8', 'Note-7', 'Note-6', 'Note-5', 'Note-4'])

    // Delete Note-8 (on-dashboard) and Note-6 (on-dashboard)
    await page.goto(NOTES_URL_NO_WS)
    await deleteNote(page, 'Note-8')
    await deleteNote(page, 'Note-6')

    // Dashboard: older notes rotate in
    await page.goto(DASH_URL_NO_WS)
    await waitForDashNoteCount(page, 5)
    expect(await getDashNoteTexts(page)).toEqual(['Note-7', 'Note-5', 'Note-4', 'Note-3', 'Note-2'])

    // Delete Note-1 (off-dashboard)
    await page.goto(NOTES_URL_NO_WS)
    await deleteNote(page, 'Note-1')

    // Dashboard unchanged — off-dashboard delete doesn't affect display
    await page.goto(DASH_URL_NO_WS)
    await waitForDashNoteCount(page, 5)
    expect(await getDashNoteTexts(page)).toEqual(['Note-7', 'Note-5', 'Note-4', 'Note-3', 'Note-2'])

    // Delete Note-7, Note-5, Note-4, Note-3
    await page.goto(NOTES_URL_NO_WS)
    await deleteNote(page, 'Note-7')
    await deleteNote(page, 'Note-5')
    await deleteNote(page, 'Note-4')
    await deleteNote(page, 'Note-3')

    // Dashboard: only Note-2 remains
    await page.goto(DASH_URL_NO_WS)
    await waitForDashNoteCount(page, 1)
    expect(await getDashNoteTexts(page)).toEqual(['Note-2'])
  })
})

test.describe('same-session (with WS)', () => {
  test('dashboard removes deleted notes', async ({ page }) => {
    // Create 8 notes
    await page.goto(NOTES_URL)
    for (let i = 1; i <= 8; i++) {
      await addNote(page, `Note-${i}`)
    }
    await waitForNoteCount(page, 8)

    // Dashboard shows 5 most recent
    await page.goto(DASH_URL)
    await waitForDashNoteCount(page, 5)
    expect(await getDashNoteTexts(page)).toEqual(['Note-8', 'Note-7', 'Note-6', 'Note-5', 'Note-4'])

    // Delete Note-8 and Note-6
    await page.goto(NOTES_URL)
    await deleteNote(page, 'Note-8')
    await deleteNote(page, 'Note-6')

    // Dashboard: older notes rotate in
    await page.goto(DASH_URL)
    await waitForDashNoteCount(page, 5)
    expect(await getDashNoteTexts(page)).toEqual(['Note-7', 'Note-5', 'Note-4', 'Note-3', 'Note-2'])

    // Delete Note-1 (off-dashboard)
    await page.goto(NOTES_URL)
    await deleteNote(page, 'Note-1')

    // Dashboard unchanged
    await page.goto(DASH_URL)
    await waitForDashNoteCount(page, 5)
    expect(await getDashNoteTexts(page)).toEqual(['Note-7', 'Note-5', 'Note-4', 'Note-3', 'Note-2'])

    // Delete Note-7, Note-5, Note-4, Note-3
    await page.goto(NOTES_URL)
    await deleteNote(page, 'Note-7')
    await deleteNote(page, 'Note-5')
    await deleteNote(page, 'Note-4')
    await deleteNote(page, 'Note-3')

    // Dashboard: only Note-2 remains
    await page.goto(DASH_URL)
    await waitForDashNoteCount(page, 1)
    expect(await getDashNoteTexts(page)).toEqual(['Note-2'])
  })
})

test.describe('multi-session WS', () => {
  test('dashboard reflects deletions and rotates older notes in', async ({ page, browser }) => {
    const context2 = await browser.newContext()
    try {
      const pageB = await context2.newPage()

      // pageA: create 10 notes
      await gotoWithWsSubscribed(page, NOTES_URL)
      for (let i = 1; i <= 10; i++) {
        await addNote(page, `Note-${i}`)
      }
      await waitForNoteCount(page, 10)

      // pageB: dashboard shows 5 most recent
      await gotoWithWsSubscribed(pageB, DASH_URL)
      await waitForDashNoteCount(pageB, 5)
      expect(await getDashNoteTexts(pageB)).toEqual([
        'Note-10',
        'Note-9',
        'Note-8',
        'Note-7',
        'Note-6',
      ])

      // Delete Note-3 (off-dashboard) — pageB dashboard stays the same
      await deleteNote(page, 'Note-3')
      // Brief wait to ensure WS event propagates — dashboard should stay at 5 with same titles
      await page.waitForTimeout(500)
      await waitForDashNoteCount(pageB, 5)
      expect(await getDashNoteTexts(pageB)).toEqual([
        'Note-10',
        'Note-9',
        'Note-8',
        'Note-7',
        'Note-6',
      ])

      // Delete Note-10 (on-dashboard) — pageB: Note-5 rotates in
      await deleteNote(page, 'Note-10')
      await waitForDashNoteAbsent(pageB, 'Note-10')
      await waitForDashNoteCount(pageB, 5)
      expect(await getDashNoteTexts(pageB)).toEqual([
        'Note-9',
        'Note-8',
        'Note-7',
        'Note-6',
        'Note-5',
      ])

      // Delete Note-9 and Note-7 (on-dashboard)
      await deleteNote(page, 'Note-9')
      await waitForDashNoteAbsent(pageB, 'Note-9')
      await deleteNote(page, 'Note-7')
      await waitForDashNoteAbsent(pageB, 'Note-7')
      await waitForDashNoteCount(pageB, 5)
      expect(await getDashNoteTexts(pageB)).toEqual([
        'Note-8',
        'Note-6',
        'Note-5',
        'Note-4',
        'Note-2',
      ])

      // Delete remaining except Note-1
      await deleteNote(page, 'Note-8')
      await waitForDashNoteAbsent(pageB, 'Note-8')
      await deleteNote(page, 'Note-6')
      await waitForDashNoteAbsent(pageB, 'Note-6')
      await deleteNote(page, 'Note-5')
      await waitForDashNoteAbsent(pageB, 'Note-5')
      await deleteNote(page, 'Note-4')
      await waitForDashNoteAbsent(pageB, 'Note-4')
      await deleteNote(page, 'Note-2')
      await waitForDashNoteAbsent(pageB, 'Note-2')

      await waitForDashNoteCount(pageB, 1)
      expect(await getDashNoteTexts(pageB)).toEqual(['Note-1'])
    } finally {
      await context2.close()
    }
  })

  test('note deletion does not break subsequent todo propagation', async ({ page, browser }) => {
    const context2 = await browser.newContext()
    try {
      const pageB = await context2.newPage()

      // pageA: create 10 notes, then delete 2
      await gotoWithWsSubscribed(page, NOTES_URL)
      for (let i = 1; i <= 10; i++) {
        await addNote(page, `Note-${i}`)
      }
      await waitForNoteCount(page, 10)
      await deleteNote(page, 'Note-10')
      await deleteNote(page, 'Note-9')

      // pageB: dashboard shows updated notes (Note-8 through Note-4)
      await gotoWithWsSubscribed(pageB, DASH_URL)
      await waitForDashNoteCount(pageB, 5)
      expect(await getDashNoteTexts(pageB)).toEqual([
        'Note-8',
        'Note-7',
        'Note-6',
        'Note-5',
        'Note-4',
      ])

      // pageA: create a todo
      await gotoWithWsSubscribed(page, TODOS_URL)
      await addTodo(page, 'Cross-stream todo')

      // pageB: the new todo appears on dashboard (proves WS still works across streams)
      await waitForDashTodosReady(pageB)
      await expect(pageB.locator('.dash-todo-item', { hasText: 'Cross-stream todo' })).toBeVisible()
    } finally {
      await context2.close()
    }
  })

  test('WS propagation stops after interleaved stream operations (gap bug)', async ({
    page,
    browser,
  }) => {
    const context2 = await browser.newContext()
    try {
      const pageB = await context2.newPage()

      // pageB opens dashboard FIRST (empty server, seeds nothing).
      // This ensures subsequent events arrive via WS and populate the gap buffer.
      await gotoWithWsSubscribed(pageB, DASH_URL)

      // pageA: create 3 notes (each on its own stream).
      // pageB receives all 3 NoteCreated events via WS individually.
      // Gap buffer: {Note-1: [P1], Note-2: [P2], Note-3: [P3]}
      await gotoWithWsSubscribed(page, NOTES_URL)
      await addNote(page, 'Note-1')
      await addNote(page, 'Note-2')
      await addNote(page, 'Note-3')
      await waitForNoteCount(page, 3)
      await waitForDashNoteCount(pageB, 3)

      // pageA: delete Note-1.
      // NoteDeleted event on Note-1's stream (position P4, revision 2).
      // Gap buffer for Note-1: [P1, P4] — positions P2, P3 belong to
      // Note-2 and Note-3's streams, not Note-1's.
      // With the bug (position-based): false gap between P1 and P4.
      // With the fix (revision-based): revisions [1, 2] are contiguous.
      //
      // This event IS processed (hasGaps was false before caching),
      // but now hasGaps() returns true for all subsequent events.
      await deleteNote(page, 'Note-1')
      await waitForDashNoteAbsent(pageB, 'Note-1')
      await waitForDashNoteCount(pageB, 2)

      // pageA: create Note-4.
      // With the bug: hasGaps()=true → event cached but NOT processed.
      // pageB dashboard stays at 2 notes.
      // With the fix: hasGaps()=false → processed normally, 3 notes.
      await addNote(page, 'Note-4')
      await waitForNoteCount(page, 3)

      // pageB: should see 3 notes (Note-4, Note-3, Note-2)
      await waitForDashNoteCount(pageB, 3)
      expect(await getDashNoteTexts(pageB)).toEqual(['Note-4', 'Note-3', 'Note-2'])
    } finally {
      await context2.close()
    }
  })
})
