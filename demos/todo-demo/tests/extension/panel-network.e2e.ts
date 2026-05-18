import { expect, getOutgoing, sendToPanel, test } from './fixtures.js'
import { switchTab } from './panel-helpers.js'

// ---------------------------------------------------------------------------
// Inline probe-event factories — minimal versions of NetworkProbeEvent shapes.
// ---------------------------------------------------------------------------

interface ProbeSession {
  sessionId: string
  targetType: string
  targetUrl: string
  targetId?: string
}

const SHARED_WORKER_SESSION: ProbeSession = {
  sessionId: 'sw-1',
  targetType: 'shared_worker',
  targetUrl: 'http://localhost:5173/src/workers/shared-worker.ts',
  targetId: 'sw-1',
}

function netEvent(event: unknown): { type: 'net-event'; event: unknown } {
  return { type: 'net-event', event }
}

function targetAttached(session = SHARED_WORKER_SESSION): unknown {
  return {
    kind: 'target-attached',
    session,
    cdpTimestamp: 0,
    wallTime: Date.now(),
    waitingForDebugger: false,
  }
}

function requestWillBeSent(opts: {
  recordId: string
  url: string
  method?: string
  resourceType?: string
  wallTime?: number
}): unknown {
  return {
    kind: 'request-will-be-sent',
    recordId: opts.recordId,
    requestId: opts.recordId,
    session: SHARED_WORKER_SESSION,
    cdpTimestamp: 0,
    wallTime: opts.wallTime ?? Date.now(),
    url: opts.url,
    method: opts.method ?? 'POST',
    headers: {},
    hasPostData: false,
    resourceType: opts.resourceType ?? 'Fetch',
  }
}

function responseReceived(opts: {
  recordId: string
  status: number
  mimeType?: string
  wallTime?: number
}): unknown {
  return {
    kind: 'response-received',
    recordId: opts.recordId,
    requestId: opts.recordId,
    session: SHARED_WORKER_SESSION,
    cdpTimestamp: 0,
    wallTime: opts.wallTime ?? Date.now(),
    url: '',
    status: opts.status,
    statusText: 'OK',
    headers: {},
    mimeType: opts.mimeType ?? 'application/json',
  }
}

function loadingFinished(opts: { recordId: string; bytes?: number; wallTime?: number }): unknown {
  return {
    kind: 'loading-finished',
    recordId: opts.recordId,
    requestId: opts.recordId,
    session: SHARED_WORKER_SESSION,
    cdpTimestamp: 0,
    wallTime: opts.wallTime ?? Date.now(),
    encodedDataLength: opts.bytes ?? 0,
  }
}

function wsFrameSent(opts: { recordId: string; payload: string; wallTime?: number }): unknown {
  return {
    kind: 'ws-frame-sent',
    recordId: opts.recordId,
    requestId: opts.recordId,
    session: SHARED_WORKER_SESSION,
    cdpTimestamp: 0,
    wallTime: opts.wallTime ?? Date.now(),
    opcode: 1,
    mask: false,
    payloadSize: opts.payload.length,
    payloadPreview: opts.payload,
  }
}

function responseBody(opts: { recordId: string; body: string }): unknown {
  return {
    kind: 'response-body',
    recordId: opts.recordId,
    requestId: opts.recordId,
    session: SHARED_WORKER_SESSION,
    cdpTimestamp: 0,
    wallTime: Date.now(),
    body: opts.body,
    base64Encoded: false,
    truncated: false,
  }
}

// ---------------------------------------------------------------------------

test.describe('Layer 2: Panel Network Tab', () => {
  test('Start button sends MSG_NET_CAPTURE_START with origin', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Network')
    await page.locator('button[title="Start capture"]').click()

    const outgoing = await getOutgoing(page)
    const startMsg = outgoing.find(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        (m as Record<string, unknown>)['type'] === 'net-capture-start',
    ) as Record<string, unknown> | undefined
    expect(startMsg).toBeDefined()
    expect(startMsg?.['origin']).toBe('http://localhost:5173')
  })

  test('capture state transitions update the toggle icon', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Network')

    // Idle → green play visible
    await expect(page.locator('button[title="Start capture"]')).toBeVisible()

    // Simulate background reporting capturing state.
    await sendToPanel(page, { type: 'net-capture-state', state: { status: 'capturing' } })

    // Stop icon should now be rendered.
    await expect(page.locator('button[title="Stop capture"]')).toBeVisible()
  })

  test('probe events render rows with HTTP method, status, type', async ({
    mockPanelPage: page,
  }) => {
    await switchTab(page, 'Network')
    await sendToPanel(page, { type: 'net-capture-state', state: { status: 'capturing' } })
    await sendToPanel(page, netEvent(targetAttached()))
    await sendToPanel(
      page,
      netEvent(
        requestWillBeSent({
          recordId: 'sw-1:rq-1',
          url: 'http://localhost:5173/api/todos/commands',
        }),
      ),
    )
    await sendToPanel(page, netEvent(responseReceived({ recordId: 'sw-1:rq-1', status: 200 })))
    await sendToPanel(page, netEvent(loadingFinished({ recordId: 'sw-1:rq-1', bytes: 783 })))

    // Count chip
    await expect(page.locator('.count')).toContainText('1/1')

    // Row text — verify URL basename and method are present somewhere in body
    const body = page.locator('[data-network-row-id="sw-1:rq-1"]')
    await expect(body).toContainText('POST')
    await expect(body).toContainText('200')
  })

  test('HTTP / WS toggles hide rows and their filter inputs', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Network')
    await sendToPanel(page, { type: 'net-capture-state', state: { status: 'capturing' } })
    await sendToPanel(page, netEvent(targetAttached()))
    await sendToPanel(
      page,
      netEvent(requestWillBeSent({ recordId: 'sw-1:rq-1', url: 'http://x/y' })),
    )
    await sendToPanel(
      page,
      netEvent(wsFrameSent({ recordId: 'sw-1:ws-1', payload: '{"type":"subscribe"}' })),
    )

    // Both rows present
    await expect(page.locator('[data-network-row-id]')).toHaveCount(2)
    await expect(page.locator('input[placeholder="Filter HTTP"]')).toBeVisible()
    await expect(page.locator('input[placeholder="Filter WS"]')).toBeVisible()

    // Toggle WS off — WS row hides, Filter WS input hides.
    await page.locator('button', { hasText: /^WS$/ }).click()
    await expect(page.locator('[data-network-row-id]')).toHaveCount(1)
    await expect(page.locator('input[placeholder="Filter WS"]')).toHaveCount(0)
    await expect(page.locator('input[placeholder="Filter HTTP"]')).toBeVisible()

    // Toggle HTTP off — HTTP row hides too, Filter HTTP also hides.
    await page.locator('button', { hasText: /^HTTP$/ }).click()
    await expect(page.locator('[data-network-row-id]')).toHaveCount(0)
    await expect(page.locator('input[placeholder="Filter HTTP"]')).toHaveCount(0)
  })

  test('Columns selector hides a column from the header', async ({ mockPanelPage: page }) => {
    await switchTab(page, 'Network')
    await sendToPanel(page, { type: 'net-capture-state', state: { status: 'capturing' } })
    await sendToPanel(page, netEvent(targetAttached()))
    await sendToPanel(
      page,
      netEvent(requestWillBeSent({ recordId: 'sw-1:rq-1', url: 'http://x/y' })),
    )

    // Open Columns popup, toggle off "Method" (default-on).
    const columns = page.locator('.multi-select', { hasText: 'Columns' })
    await columns.locator('.multi-select-btn').click()
    await columns.locator('.multi-select-item', { hasText: 'Method' }).click()
    await columns.locator('.multi-select-close').click()

    // Header should no longer include "Method".
    const header = page.locator('[style*="grid-template-columns"]').first()
    await expect(header).not.toContainText('Method')
  })

  test('Response tab renders captured body, pretty-printing JSON', async ({
    mockPanelPage: page,
  }) => {
    await switchTab(page, 'Network')
    await sendToPanel(page, { type: 'net-capture-state', state: { status: 'capturing' } })
    await sendToPanel(page, netEvent(targetAttached()))
    await sendToPanel(
      page,
      netEvent(requestWillBeSent({ recordId: 'sw-1:rq-1', url: 'http://x/y' })),
    )
    await sendToPanel(
      page,
      netEvent(
        responseReceived({ recordId: 'sw-1:rq-1', status: 200, mimeType: 'application/json' }),
      ),
    )
    await sendToPanel(page, netEvent(loadingFinished({ recordId: 'sw-1:rq-1', bytes: 12 })))
    await sendToPanel(
      page,
      netEvent(responseBody({ recordId: 'sw-1:rq-1', body: '{"id":"42","ok":true}' })),
    )

    // Select the row and click the Response tab.
    await page.locator('[data-network-row-id="sw-1:rq-1"]').click()
    await page.locator('button', { hasText: 'Response' }).click()

    // Body should be visible and pretty-printed (indented).
    const pre = page.locator('pre').filter({ hasText: '"id"' })
    await expect(pre).toBeVisible()
    await expect(pre).toContainText('"id": "42"')
  })
})
