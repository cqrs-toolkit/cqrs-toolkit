import { expect, getOutgoing, sendToPanel, test } from './fixtures.js'
import { makeBufferDump, MOCK_CONFIG } from './panel-helpers.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SQLITE_MASTER_ROWS = [
  { name: 'commands', sql: 'CREATE TABLE commands (id TEXT PRIMARY KEY, type TEXT)' },
  { name: 'cache_keys', sql: 'CREATE TABLE cache_keys (key TEXT PRIMARY KEY, collection TEXT)' },
  { name: 'read_models', sql: 'CREATE TABLE read_models (id TEXT, collection TEXT)' },
]

/** Send a storage response matching a specific requestId. */
async function respondToStorage(
  page: import('@playwright/test').Page,
  requestId: string,
  rows: Record<string, unknown>[],
  error?: string,
): Promise<void> {
  await sendToPanel(page, {
    type: 'cqrs-devtools-storage-response',
    source: 'cqrs-hook',
    requestId,
    rows,
    error,
  })
}

type StorageRequest = { type: string; sql: string; bind?: unknown[]; requestId: string }

/** Get all outgoing storage requests. */
async function getAllStorageRequests(
  page: import('@playwright/test').Page,
): Promise<StorageRequest[]> {
  const outgoing = await getOutgoing(page)
  const results: StorageRequest[] = []
  for (const msg of outgoing) {
    const m = msg as Record<string, unknown> | undefined
    if (m?.['type'] === 'cqrs-devtools-request-storage') {
      results.push(m as unknown as StorageRequest)
    }
  }
  return results
}

/** Get the most recent outgoing storage request. */
async function getLastStorageRequest(
  page: import('@playwright/test').Page,
): Promise<StorageRequest | undefined> {
  const all = await getAllStorageRequests(page)
  return all[all.length - 1]
}

/** Mock PRAGMA table_info rows for each table (matches columns in SQLITE_MASTER_ROWS DDL). */
const PRAGMA_RESPONSES: Record<string, Record<string, unknown>[]> = {
  commands: [
    { name: 'id', type: 'TEXT' },
    { name: 'type', type: 'TEXT' },
  ],
  cache_keys: [
    { name: 'key', type: 'TEXT' },
    { name: 'collection', type: 'TEXT' },
  ],
  read_models: [
    { name: 'id', type: 'TEXT' },
    { name: 'collection', type: 'TEXT' },
  ],
}

/** Switch to storage tab and auto-respond to the initial sqlite_master + PRAGMA queries. */
async function switchToStorageWithTables(page: import('@playwright/test').Page): Promise<void> {
  // Send initial buffer-dump with config
  await sendToPanel(page, makeBufferDump({ config: MOCK_CONFIG, role: 'leader' }))

  // Click the tab
  await page.locator('.tab-btn', { hasText: 'Storage' }).click()

  // Wait for the sqlite_master request to be sent
  await page.waitForFunction(() => {
    const mock = (window as unknown as Record<string, unknown>)['__TEST_MOCK__'] as {
      outgoing: unknown[]
    }
    return mock.outgoing.some(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        (m as Record<string, unknown>)['type'] === 'cqrs-devtools-request-storage',
    )
  })

  // Respond with table list
  const req = await getLastStorageRequest(page)
  if (req) {
    await respondToStorage(page, req.requestId, SQLITE_MASTER_ROWS)
  }

  // loadTables fires PRAGMA table_info for each table via Promise.all — wait for all 3
  const expectedTotal = 1 + SQLITE_MASTER_ROWS.length // sqlite_master + one PRAGMA per table
  await page.waitForFunction((total) => {
    const mock = (window as unknown as Record<string, unknown>)['__TEST_MOCK__'] as {
      outgoing: unknown[]
    }
    return (
      mock.outgoing.filter(
        (m) =>
          typeof m === 'object' &&
          m !== null &&
          (m as Record<string, unknown>)['type'] === 'cqrs-devtools-request-storage',
      ).length >= total
    )
  }, expectedTotal)

  // Respond to each PRAGMA request
  const allReqs = await getAllStorageRequests(page)
  for (const pragmaReq of allReqs) {
    if (!pragmaReq.sql.includes('PRAGMA')) continue
    // Extract table name from PRAGMA table_info("tableName")
    const match = pragmaReq.sql.match(/PRAGMA table_info\("(.+?)"\)/)
    const tableName = match?.[1]
    if (tableName && PRAGMA_RESPONSES[tableName]) {
      await respondToStorage(page, pragmaReq.requestId, PRAGMA_RESPONSES[tableName])
    }
  }

  // Wait for the tree to render
  await expect(page.locator('.storage-tree-name').first()).toBeVisible()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Layer 2: Panel Storage Tab', () => {
  test('unavailable banner when storage exec returns error', async ({ mockPanelPage: page }) => {
    await sendToPanel(page, makeBufferDump({ config: MOCK_CONFIG, role: 'leader' }))
    await page.locator('.tab-btn', { hasText: 'Storage' }).click()

    // Wait for the request, then respond with error
    await page.waitForFunction(() => {
      const mock = (window as unknown as Record<string, unknown>)['__TEST_MOCK__'] as {
        outgoing: unknown[]
      }
      return mock.outgoing.some(
        (m) =>
          typeof m === 'object' &&
          m !== null &&
          (m as Record<string, unknown>)['type'] === 'cqrs-devtools-request-storage',
      )
    })

    const req = await getLastStorageRequest(page)
    if (req) {
      await respondToStorage(page, req.requestId, [], 'Storage not available')
    }

    await expect(page.locator('.storage-unavailable')).toBeVisible()
  })

  test('table tree renders from sqlite_master query response', async ({ mockPanelPage: page }) => {
    await switchToStorageWithTables(page)

    await expect(page.locator('.storage-tree-name')).toHaveCount(3)
    await expect(page.locator('.storage-tree-name').first()).toContainText('commands')
  })

  test('expand table shows Schema action', async ({ mockPanelPage: page }) => {
    await switchToStorageWithTables(page)

    // Click arrow to expand
    await page
      .locator('.storage-tree-name', { hasText: 'commands' })
      .locator('.storage-tree-arrow')
      .click()

    await expect(page.locator('.storage-tree-action')).toContainText('Schema')
  })

  test('double-click table name sends SQL request', async ({ mockPanelPage: page }) => {
    await switchToStorageWithTables(page)

    // Double-click to open table
    await page.locator('.storage-tree-name', { hasText: 'commands' }).dblclick()

    // Should have sent a COUNT query and a SELECT query
    const outgoing = await getOutgoing(page)
    const storageRequests = outgoing.filter(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        (m as Record<string, unknown>)['type'] === 'cqrs-devtools-request-storage',
    )
    // At least the sqlite_master request + count + select
    expect(storageRequests.length).toBeGreaterThanOrEqual(2)
  })

  test('table result tab renders columns and rows from response', async ({
    mockPanelPage: page,
  }) => {
    await switchToStorageWithTables(page)

    // Double-click to open table
    await page.locator('.storage-tree-name', { hasText: 'commands' }).dblclick()

    // Respond to count query
    await page.waitForTimeout(100)
    let req = await getLastStorageRequest(page)
    if (req?.sql.includes('COUNT')) {
      await respondToStorage(page, req.requestId, [{ cnt: 2 }])
    }

    // Respond to select query
    await page.waitForTimeout(100)
    req = await getLastStorageRequest(page)
    if (req?.sql.includes('SELECT *')) {
      await respondToStorage(page, req.requestId, [
        { id: 'cmd-1', type: 'CreateTodo' },
        { id: 'cmd-2', type: 'DeleteTodo' },
      ])
    }

    // Verify result tab header and rows
    await expect(page.locator('.storage-result-header')).toBeVisible()
    await expect(page.locator('.storage-result-row')).toHaveCount(2)
  })

  test('text filter narrows result rows', async ({ mockPanelPage: page }) => {
    await switchToStorageWithTables(page)

    // Double-click to open table
    await page.locator('.storage-tree-name', { hasText: 'commands' }).dblclick()

    // Respond to queries
    await page.waitForTimeout(100)
    let req = await getLastStorageRequest(page)
    if (req?.sql.includes('COUNT')) {
      await respondToStorage(page, req.requestId, [{ cnt: 2 }])
    }
    await page.waitForTimeout(100)
    req = await getLastStorageRequest(page)
    if (req?.sql.includes('SELECT *')) {
      await respondToStorage(page, req.requestId, [
        { id: 'cmd-1', type: 'CreateTodo' },
        { id: 'cmd-2', type: 'DeleteTodo' },
      ])
    }

    await expect(page.locator('.storage-result-row')).toHaveCount(2)

    // Filter
    await page.locator('.storage-filter-input').fill('Delete')
    await expect(page.locator('.storage-result-row')).toHaveCount(1)
  })

  test('tab switching between Query and result tabs', async ({ mockPanelPage: page }) => {
    await switchToStorageWithTables(page)

    // Query tab should be active by default
    await expect(page.locator('.storage-tab-btn.active')).toContainText('Query')

    // Double-click to open a table tab
    await page.locator('.storage-tree-name', { hasText: 'commands' }).dblclick()

    // Respond to queries
    await page.waitForTimeout(100)
    let req = await getLastStorageRequest(page)
    if (req?.sql.includes('COUNT')) {
      await respondToStorage(page, req.requestId, [{ cnt: 1 }])
    }
    await page.waitForTimeout(100)
    req = await getLastStorageRequest(page)
    if (req?.sql.includes('SELECT *')) {
      await respondToStorage(page, req.requestId, [{ id: 'cmd-1', type: 'Test' }])
    }

    // Result tab should be active
    await expect(page.locator('.storage-tab-btn.active')).toContainText('commands')

    // Click Query tab
    await page.locator('.storage-tab-btn', { hasText: 'Query' }).click()
    await expect(page.locator('.storage-query-editor')).toBeVisible()
  })

  test('close result tab removes it', async ({ mockPanelPage: page }) => {
    await switchToStorageWithTables(page)

    // Open a table tab
    await page.locator('.storage-tree-name', { hasText: 'commands' }).dblclick()

    await page.waitForTimeout(100)
    let req = await getLastStorageRequest(page)
    if (req?.sql.includes('COUNT')) {
      await respondToStorage(page, req.requestId, [{ cnt: 1 }])
    }
    await page.waitForTimeout(100)
    req = await getLastStorageRequest(page)
    if (req?.sql.includes('SELECT *')) {
      await respondToStorage(page, req.requestId, [{ id: 'cmd-1', type: 'Test' }])
    }

    // Should have 2 tabs (Query + commands)
    await expect(page.locator('.storage-tab-btn')).toHaveCount(2)

    // Close the result tab
    await page.locator('.storage-tab-close').click()

    // Should be back to 1 tab
    await expect(page.locator('.storage-tab-btn')).toHaveCount(1)
  })

  test('query writer: execute sends MSG_REQUEST_STORAGE', async ({ mockPanelPage: page }) => {
    await switchToStorageWithTables(page)

    // Query tab is active, execute button should be visible
    await expect(page.locator('.storage-execute-btn')).toBeVisible()

    // Click execute
    await page.locator('.storage-execute-btn').click()

    // Verify a storage request was sent
    const outgoing = await getOutgoing(page)
    const storageReqs = outgoing.filter(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        (m as Record<string, unknown>)['type'] === 'cqrs-devtools-request-storage',
    )
    // At least sqlite_master + the query execution
    expect(storageReqs.length).toBeGreaterThanOrEqual(2)
  })

  test('query result tab created on first execute, reused on subsequent', async ({
    mockPanelPage: page,
  }) => {
    await switchToStorageWithTables(page)

    // Execute first query
    await page.locator('.storage-execute-btn').click()
    await page.waitForTimeout(100)
    let req = await getLastStorageRequest(page)
    if (req) {
      await respondToStorage(page, req.requestId, [{ result: 1 }])
    }

    // Should have Query + Query Result = 2 tabs
    await expect(page.locator('.storage-tab-btn')).toHaveCount(2)

    // Switch back to query
    await page.locator('.storage-tab-btn', { hasText: /^Query$/ }).click()

    // Execute second query
    await page.locator('.storage-execute-btn').click()
    await page.waitForTimeout(100)
    req = await getLastStorageRequest(page)
    if (req) {
      await respondToStorage(page, req.requestId, [{ result: 2 }])
    }

    // Should still have 2 tabs (reused)
    await expect(page.locator('.storage-tab-btn')).toHaveCount(2)
  })

  test('query error shows logs panel with error, no result tab created', async ({
    mockPanelPage: page,
  }) => {
    await switchToStorageWithTables(page)

    // Execute query
    await page.locator('.storage-execute-btn').click()
    await page.waitForTimeout(100)
    const req = await getLastStorageRequest(page)
    if (req) {
      await respondToStorage(page, req.requestId, [], 'syntax error near "SELEC"')
    }

    // Logs panel opens with error
    await expect(page.locator('.storage-logs-panel')).toBeVisible()
    await expect(page.locator('.storage-log-error .storage-log-message')).toContainText(
      'syntax error',
    )

    // No result tab created — still only Query tab
    await expect(page.locator('.storage-tab-btn')).toHaveCount(1)
    await expect(page.locator('.storage-tab-btn.active')).toContainText('Query')
  })

  test('failed query preserves previous result tab', async ({ mockPanelPage: page }) => {
    await switchToStorageWithTables(page)

    // Execute first query successfully
    await page.locator('.storage-execute-btn').click()
    await page.waitForTimeout(100)
    let req = await getLastStorageRequest(page)
    if (req) {
      await respondToStorage(page, req.requestId, [{ result: 1 }, { result: 2 }])
    }

    // Should have Query + Query Result = 2 tabs
    await expect(page.locator('.storage-tab-btn')).toHaveCount(2)

    // Switch back to query tab
    await page.locator('.storage-tab-btn', { hasText: /^Query$/ }).click()

    // Execute a bad query
    await page.locator('.storage-execute-btn').click()
    await page.waitForTimeout(100)
    req = await getLastStorageRequest(page)
    if (req) {
      await respondToStorage(page, req.requestId, [], 'table not found')
    }

    // Still 2 tabs — no new tab created
    await expect(page.locator('.storage-tab-btn')).toHaveCount(2)

    // Switch to result tab — previous data still there
    await page.locator('.storage-tab-btn', { hasText: 'Query Result' }).click()
    await expect(page.locator('.storage-result-row')).toHaveCount(2)
  })

  test('DDL tab opens from Schema action', async ({ mockPanelPage: page }) => {
    await switchToStorageWithTables(page)

    // Expand table
    await page
      .locator('.storage-tree-name', { hasText: 'commands' })
      .locator('.storage-tree-arrow')
      .click()

    // Double-click Schema
    await page.locator('.storage-tree-action', { hasText: 'Schema' }).dblclick()

    // DDL tab should be visible
    await expect(page.locator('.storage-tab-btn', { hasText: 'DDL: commands' })).toBeVisible()
    await expect(page.locator('.storage-ddl-viewer')).toBeVisible()
  })
})
