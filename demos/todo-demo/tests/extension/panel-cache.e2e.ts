import { expect, getOutgoing, sendToPanel, test } from './fixtures.js'
import { makeEvent, switchTab, toggleMultiSelectOption } from './panel-helpers.js'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Layer 2: Panel Cache Tab', () => {
  test('empty state', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Cache')

    await expect(page.locator('.empty-state')).toContainText('No cache keys')
  })

  test('cache:key-acquired populates row', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Cache')

    const event = makeEvent('cache:key-acquired', {
      cacheKey: 'ck-abc12345',
      collection: 'todos',
      evictionPolicy: 'passive',
    })
    await sendToPanel(page, { type: 'cqrs-devtools-event', event })

    await expect(page.locator('.cache-row')).toHaveCount(1)
    await expect(page.locator('.cache-col-collection')).toContainText('todos')
  })

  test('multiple keys render', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Cache')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-1',
        collection: 'todos',
        evictionPolicy: 'passive',
      }),
    })
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-2',
        collection: 'notes',
        evictionPolicy: 'active',
      }),
    })

    await expect(page.locator('.cache-row')).toHaveCount(2)
    await expect(page.locator('.count')).toContainText('2 keys')
  })

  test('eviction updates status badge', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Cache')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-evict',
        collection: 'todos',
        evictionPolicy: 'passive',
      }),
    })

    // Initially active
    await expect(page.locator('.cache-status-active')).toBeVisible()

    // Evict it
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:evicted', {
        cacheKey: 'ck-evict',
        reason: 'ttl-expired',
      }),
    })

    await expect(page.locator('.cache-status-evicted')).toBeVisible()
    await expect(page.locator('.cache-status-active')).not.toBeVisible()
  })

  test('collection filter', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Cache')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-t1',
        collection: 'todos',
        evictionPolicy: 'passive',
      }),
    })
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-n1',
        collection: 'notes',
        evictionPolicy: 'passive',
      }),
    })

    await expect(page.locator('.cache-row')).toHaveCount(2)

    // Filter by 'todos' collection using the multi-select dropdown
    await toggleMultiSelectOption(page, '.collection-selector', 'todos')

    await expect(page.locator('.cache-row')).toHaveCount(1)
    await expect(page.locator('.cache-col-collection')).toContainText('todos')

    // Reset filter by deselecting 'todos'
    await toggleMultiSelectOption(page, '.collection-selector', 'todos')
    await expect(page.locator('.cache-row')).toHaveCount(2)
  })

  test('row click shows detail', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Cache')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-detail-test',
        collection: 'todos',
        evictionPolicy: 'passive',
      }),
    })

    await page.locator('.cache-row').click()

    await expect(page.locator('.cache-detail')).toBeVisible()
    // Detail shows the full key
    await expect(page.locator('.cache-detail')).toContainText('ck-detail-test')
    // Detail shows the collection name
    await expect(page.locator('.cache-detail')).toContainText('todos')
  })

  test('detail close button', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Cache')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-close-test',
        collection: 'todos',
        evictionPolicy: 'passive',
      }),
    })

    await page.locator('.cache-row').click()
    await expect(page.locator('.cache-detail')).toBeVisible()

    await page.locator('.detail-close-btn').click()
    await expect(page.locator('.cache-detail')).not.toBeVisible()
  })

  test('clear button', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Cache')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('cache:key-acquired', {
        cacheKey: 'ck-clear',
        collection: 'todos',
        evictionPolicy: 'passive',
      }),
    })

    await expect(page.locator('.cache-row')).toHaveCount(1)

    await page.locator('.toolbar-btn', { hasText: 'Clear' }).click()

    await expect(page.locator('.empty-state')).toContainText('No cache keys')

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
