import type { CommandStatus } from '@cqrs-toolkit/client'
import { expect, getOutgoing, sendToPanel, test } from './fixtures.js'
import {
  MOCK_CONFIG,
  makeBufferDump,
  makeCommand,
  makeEvent,
  resetIdCounter,
  toggleChipOption,
} from './panel-helpers.js'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Layer 2: Panel Commands Tab', () => {
  test.beforeEach(() => {
    resetIdCounter()
  })

  test('waiting state on empty buffer-dump', async ({ mockPanelPage: page }) => {
    await sendToPanel(page, makeBufferDump())

    // Warning banner should be visible (waiting state — no config)
    await expect(page.locator('.banner-warning')).toBeVisible()
  })

  test('connected state with config', async ({ mockPanelPage: page }) => {
    await sendToPanel(page, makeBufferDump({ config: MOCK_CONFIG, role: 'leader' }))

    // Warning banner should disappear
    await expect(page.locator('.banner-warning')).not.toBeVisible()

    // "No commands" empty state should be shown
    await expect(page.locator('.empty-state')).toContainText('No commands')
  })

  test('commands render from snapshot', async ({ mockPanelPage: page }) => {
    const commands = [
      makeCommand({ type: 'CreateTodo', status: 'pending' }),
      makeCommand({ type: 'UpdateTodo', status: 'sending' }),
      makeCommand({ type: 'DeleteTodo', status: 'succeeded' }),
    ]

    await sendToPanel(page, makeBufferDump({ config: MOCK_CONFIG, role: 'leader', commands }))

    // 3 rows in the table
    await expect(page.locator('.command-row')).toHaveCount(3)

    // Count indicator
    await expect(page.locator('.count')).toContainText('3 commands')
  })

  test('live event adds command', async ({ mockPanelPage: page }) => {
    await sendToPanel(page, makeBufferDump({ config: MOCK_CONFIG, role: 'leader' }))
    await expect(page.locator('.empty-state')).toBeVisible()

    // Send a command:enqueued event
    const event = makeEvent('command:enqueued', {
      commandId: 'new-cmd-1',
      type: 'CreateTodo',
    })
    await sendToPanel(page, { type: 'cqrs-devtools-event', event })

    // New row should appear
    await expect(page.locator('.command-row')).toHaveCount(1)
  })

  test('live event updates status', async ({ mockPanelPage: page }) => {
    const cmd = makeCommand({ status: 'pending' })
    await sendToPanel(
      page,
      makeBufferDump({ config: MOCK_CONFIG, role: 'leader', commands: [cmd] }),
    )

    // Verify initial status badge
    await expect(page.locator('.status-pending')).toBeVisible()

    // Send status-changed event
    const event = makeEvent('command:status-changed', {
      commandId: cmd.commandId,
      status: 'sending' satisfies CommandStatus,
    })
    await sendToPanel(page, { type: 'cqrs-devtools-event', event })

    // Badge should update
    await expect(page.locator('.status-sending')).toBeVisible()
  })

  test('filter chips toggle', async ({ mockPanelPage: page }) => {
    const commands = [
      makeCommand({ status: 'pending' }),
      makeCommand({ status: 'failed' }),
      makeCommand({ status: 'succeeded' }),
    ]
    await sendToPanel(page, makeBufferDump({ config: MOCK_CONFIG, role: 'leader', commands }))

    await expect(page.locator('.command-row')).toHaveCount(3)

    // Toggle off 'pending' chip
    await toggleChipOption(page, '.status-selector', 'pending')

    // Only 2 rows visible
    await expect(page.locator('.command-row')).toHaveCount(2)

    // Toggle 'pending' back on
    await toggleChipOption(page, '.status-selector', 'pending')
    await expect(page.locator('.command-row')).toHaveCount(3)
  })

  test('row click shows detail', async ({ mockPanelPage: page }) => {
    const cmd = makeCommand({
      type: 'CreateTodo',
      data: { text: 'My todo' },
    })
    await sendToPanel(
      page,
      makeBufferDump({ config: MOCK_CONFIG, role: 'leader', commands: [cmd] }),
    )

    // Click the row
    await page.locator('.command-row').click()

    // Detail panel should appear
    await expect(page.locator('.command-detail')).toBeVisible()

    // Should show the command type
    await expect(page.locator('.command-detail')).toContainText('CreateTodo')

    // Should show data JSON
    await expect(page.locator('.detail-json')).toContainText('My todo')
  })

  test('retry button on failed command', async ({ mockPanelPage: page }) => {
    const cmd = makeCommand({
      status: 'failed',
      error: { source: 'server', message: 'Server error' },
    })
    await sendToPanel(
      page,
      makeBufferDump({ config: MOCK_CONFIG, role: 'leader', commands: [cmd] }),
    )

    // Select the command
    await page.locator('.command-row').click()
    await expect(page.locator('.command-detail')).toBeVisible()

    // Retry button should be visible
    const retryBtn = page.locator('.btn-primary', { hasText: 'Retry' })
    await expect(retryBtn).toBeVisible()

    // Click retry
    await retryBtn.click()

    // Check outgoing messages for action
    const outgoing = await getOutgoing(page)
    const actionMsg = outgoing.find(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        (m as Record<string, unknown>)['type'] === 'cqrs-devtools-action',
    )
    expect(actionMsg).toBeDefined()
    expect((actionMsg as Record<string, unknown>)['action']).toBe('retry')
    expect((actionMsg as Record<string, unknown>)['commandId']).toBe(cmd.commandId)
  })

  test('cancel button on pending command', async ({ mockPanelPage: page }) => {
    const cmd = makeCommand({ status: 'pending' })
    await sendToPanel(
      page,
      makeBufferDump({ config: MOCK_CONFIG, role: 'leader', commands: [cmd] }),
    )

    // Select the command
    await page.locator('.command-row').click()
    await expect(page.locator('.command-detail')).toBeVisible()

    // Cancel button should be visible
    const cancelBtn = page.locator('.btn-danger', { hasText: 'Cancel' })
    await expect(cancelBtn).toBeVisible()

    // Click cancel
    await cancelBtn.click()

    // Check outgoing messages for action
    const outgoing = await getOutgoing(page)
    const actionMsg = outgoing.find(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        (m as Record<string, unknown>)['type'] === 'cqrs-devtools-action',
    )
    expect(actionMsg).toBeDefined()
    expect((actionMsg as Record<string, unknown>)['action']).toBe('cancel')
    expect((actionMsg as Record<string, unknown>)['commandId']).toBe(cmd.commandId)
  })

  test('standby banner', async ({ mockPanelPage: page }) => {
    // Send client-detected with standby role
    await sendToPanel(page, {
      type: 'cqrs-devtools-client-detected',
      config: MOCK_CONFIG,
      role: 'standby',
    })

    // Info banner for standby should appear
    await expect(page.locator('.banner-info')).toBeVisible()
    await expect(page.locator('.banner-info')).toContainText('standby')
  })

  test('clear button', async ({ mockPanelPage: page }) => {
    const commands = [makeCommand({ status: 'pending' }), makeCommand({ status: 'succeeded' })]
    await sendToPanel(page, makeBufferDump({ config: MOCK_CONFIG, role: 'leader', commands }))

    await expect(page.locator('.command-row')).toHaveCount(2)

    // Click Clear
    await page.locator('.toolbar-btn', { hasText: 'Clear' }).click()

    // Empty state
    await expect(page.locator('.empty-state')).toBeVisible()

    // Outgoing should have panel-clear
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
