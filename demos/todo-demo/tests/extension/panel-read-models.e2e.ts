import { expect, getOutgoing, sendToPanel, test } from './fixtures.js'
import { makeEvent, switchTab, toggleMultiSelectOption } from './panel-helpers.js'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Layer 2: Panel Read Models Tab', () => {
  test('empty state', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Read Models')

    await expect(page.locator('.empty-state')).toContainText('No read models')
  })

  test('cache:key-acquired creates collection row', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Read Models')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-rm-1',
        collection: 'todos',
      }),
    })

    await expect(page.locator('.rm-row')).toHaveCount(1)
    await expect(page.locator('.rm-col-collection')).toContainText('todos')
  })

  test('readmodel:updated increments counts', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Read Models')

    // First create the collection via cache key
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-rm-2',
        collection: 'todos',
      }),
    })

    // Send an update
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('readmodel:updated', {
        collection: 'todos',
        ids: ['entity-1', 'entity-2'],
      }),
    })

    // Entity count should show 2
    await expect(page.locator('.rm-col-entities')).toContainText('2')
    // Update count should show 1
    await expect(page.locator('.rm-col-updates')).toContainText('1')

    // Send another update with one new entity
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('readmodel:updated', {
        collection: 'todos',
        ids: ['entity-2', 'entity-3'],
      }),
    })

    // Entity count should show 3 (unique)
    await expect(page.locator('.rm-col-entities')).toContainText('3')
    // Update count should show 2
    await expect(page.locator('.rm-col-updates')).toContainText('2')
  })

  test('collection filter', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Read Models')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-t',
        collection: 'todos',
      }),
    })
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-n',
        collection: 'notes',
      }),
    })

    await expect(page.locator('.rm-row')).toHaveCount(2)

    // Filter by 'todos' collection using the multi-select dropdown
    await toggleMultiSelectOption(page, '.collection-selector', 'todos')

    await expect(page.locator('.rm-row')).toHaveCount(1)
    await expect(page.locator('.rm-col-collection')).toContainText('todos')

    // Reset filter by deselecting 'todos'
    await toggleMultiSelectOption(page, '.collection-selector', 'todos')
    await expect(page.locator('.rm-row')).toHaveCount(2)
  })

  test('row click shows detail', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Read Models')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-detail-rm',
        collection: 'todos',
      }),
    })

    await page.locator('.rm-row').click()

    await expect(page.locator('.rm-detail')).toBeVisible()
    await expect(page.locator('.rm-detail')).toContainText('todos')
  })

  test('detail shows cache keys', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Read Models')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-dep-1',
        collection: 'todos',
      }),
    })
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-dep-2',
        collection: 'todos',
      }),
    })

    await page.locator('.rm-row').click()
    await expect(page.locator('.rm-detail')).toBeVisible()

    // dep-list should contain both cache keys
    await expect(page.locator('.dep-list')).toContainText('ck-dep-1')
    await expect(page.locator('.dep-list')).toContainText('ck-dep-2')
  })

  test('detail shows update history', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Read Models')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-hist',
        collection: 'todos',
      }),
    })
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('readmodel:updated', {
        collection: 'todos',
        ids: ['e-1'],
      }),
    })

    await page.locator('.rm-row').click()
    await expect(page.locator('.rm-detail')).toBeVisible()

    // debug-timeline should contain history entries
    await expect(page.locator('.debug-timeline')).toBeVisible()
    await expect(page.locator('.debug-timeline li')).toHaveCount(1)
  })

  test('detail close button', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Read Models')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-close-rm',
        collection: 'todos',
      }),
    })

    await page.locator('.rm-row').click()
    await expect(page.locator('.rm-detail')).toBeVisible()

    await page.locator('.detail-close-btn').click()
    await expect(page.locator('.rm-detail')).not.toBeVisible()
  })

  test('clear button', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Read Models')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-clear-rm',
        collection: 'todos',
      }),
    })

    await expect(page.locator('.rm-row')).toHaveCount(1)

    await page.locator('.toolbar-btn', { hasText: 'Clear' }).click()

    await expect(page.locator('.empty-state')).toContainText('No read models')

    const outgoing = await getOutgoing(page)
    const clearMsg = outgoing.find(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        (m as Record<string, unknown>)['type'] === 'panel-clear',
    )
    expect(clearMsg).toBeDefined()
  })
})
