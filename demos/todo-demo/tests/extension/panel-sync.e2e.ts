import { expect, getOutgoing, sendToPanel, test } from './fixtures.js'
import { makeEvent, switchTab } from './panel-helpers.js'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Layer 2: Panel Sync Tab', () => {
  test('empty state', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Sync')

    await expect(page.locator('.empty-state')).toContainText('No sync activity')
  })

  test('connectivity event populates row', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Sync')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('connectivity:changed', { online: true }),
    })

    await expect(page.locator('.sync-row')).toHaveCount(1)
    await expect(page.locator('.sync-col-details')).toContainText('Online')
  })

  test('connectivity indicator', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Sync')

    // Go online
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('connectivity:changed', { online: true }),
    })

    await expect(page.locator('.sync-online-dot.sync-online')).toBeVisible()

    // Go offline
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('connectivity:changed', { online: false }),
    })

    await expect(page.locator('.sync-online-dot.sync-offline')).toBeVisible()
  })

  test('ws state events', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Sync')

    // ws:connecting
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('ws:connecting', {}),
    })
    await expect(page.locator('.sync-ws-badge')).toContainText('connecting')

    // ws:connected
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('ws:connected', {}),
    })
    await expect(page.locator('.sync-ws-badge')).toContainText('connected')

    // ws:disconnected
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('ws:disconnected', {}),
    })
    await expect(page.locator('.sync-ws-badge')).toContainText('disconnected')
  })

  test('sync:started/completed flow', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Sync')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('sync:started', { collection: 'todos' }),
    })
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('sync:completed', { collection: 'todos', eventCount: 5 }),
    })

    await expect(page.locator('.sync-row')).toHaveCount(2)

    // First row should show 'Sync started'
    await expect(page.locator('.sync-row').first().locator('.sync-col-details')).toContainText(
      'Sync started',
    )

    // Second row should show '5 events'
    await expect(page.locator('.sync-row').last().locator('.sync-col-details')).toContainText(
      '5 events',
    )
  })

  test('sync:failed shows error type badge', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Sync')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('sync:failed', { collection: 'todos', error: 'Network timeout' }),
    })

    await expect(page.locator('.sync-row')).toHaveCount(1)
    await expect(page.locator('.sync-type-error')).toBeVisible()
  })

  test('session divider', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Sync')

    // Add an event first
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('connectivity:changed', { online: true }),
    })

    // Session change
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('session:changed', { userId: 'user-123' }),
    })

    await expect(page.locator('.session-divider')).toBeVisible()
    await expect(page.locator('.session-divider')).toContainText('user-123')
  })

  test('type filter', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Sync')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('connectivity:changed', { online: true }),
    })
    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('sync:started', { collection: 'todos' }),
    })

    await expect(page.locator('.sync-row')).toHaveCount(2)

    // Filter by 'sync' — should match 'sync-started' but not 'connectivity-changed'
    await page.locator('.toolbar-input').fill('sync')

    await expect(page.locator('.sync-row')).toHaveCount(1)
    await expect(page.locator('.sync-col-type')).toContainText('sync-started')

    // Clear filter
    await page.locator('.toolbar-input').fill('')
    await expect(page.locator('.sync-row')).toHaveCount(2)
  })

  test('row click shows detail', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Sync')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('sync:started', { collection: 'todos' }),
    })

    await page.locator('.sync-row').click()

    await expect(page.locator('.sync-detail')).toBeVisible()
    // Should show the sync type
    await expect(page.locator('.sync-detail')).toContainText('sync-started')
    // Should show the payload JSON
    await expect(page.locator('.detail-json')).toContainText('todos')
  })

  test('detail close button', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Sync')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('sync:started', { collection: 'todos' }),
    })

    await page.locator('.sync-row').click()
    await expect(page.locator('.sync-detail')).toBeVisible()

    await page.locator('.detail-close-btn').click()
    await expect(page.locator('.sync-detail')).not.toBeVisible()
  })

  test('clear button', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Sync')

    await sendToPanel(page, {
      type: 'cqrs-devtools-event',
      event: makeEvent('connectivity:changed', { online: true }),
    })

    await expect(page.locator('.sync-row')).toHaveCount(1)
    await expect(page.locator('.sync-online-dot')).toBeVisible()

    await page.locator('.toolbar-btn', { hasText: 'Clear' }).click()

    await expect(page.locator('.empty-state')).toContainText('No sync activity')

    // Online indicator should be cleared
    await expect(page.locator('.sync-online-dot')).not.toBeVisible()

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
