import type { CommandSuccessResponse } from '@cqrs-toolkit/demo-base/common/shared'
import type { APIRequestContext } from '@playwright/test'
import { expect, test, url } from '../../../e2e-fixtures.js'
import {
  clearCqrsEventLog,
  gotoWithWsSubscribed,
  waitForDashNotebookCount,
  waitForWsDisconnected,
  waitForWsReconnection,
} from '../../../e2e-helpers.js'

const API = 'http://localhost:3001/api'

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/test/reset`)
  await request.post(`${API}/test/ws-resume`)
})

test('recovers missed events after server WS outage', async ({ page, request }) => {
  // 1. Open dashboard with WS → create notebook → verify visible
  await gotoWithWsSubscribed(page, url('/', { mode: 'online-only', ws: true }))

  const createBody = await createNotebookViaApi(request, 'TestNB')
  const notebookId = createBody.id
  let nextRev = createBody.nextExpectedRevision

  await waitForDashNotebookCount(page, 1)

  // 2. Kill WS server-side — client misses subsequent events
  await clearCqrsEventLog(page)
  await request.post(`${API}/test/ws-pause`)
  await waitForWsDisconnected(page)

  // 3. Add tag via API — client does NOT receive this event (rev 1, missed)
  const tagRes1 = await addTagViaApi(request, notebookId, 'missed-tag', nextRev)
  nextRev = tagRes1.nextExpectedRevision

  // 4. Resume WS server-side — client reconnects via retry timer
  await request.post(`${API}/test/ws-resume`)
  await waitForWsReconnection(page)

  // 5. Small delay to ensure server-side subscription is fully processed
  //    before sending the trigger event. The client reports .ws-subscribed when
  //    it sends the subscribe message, but the server needs time to register it.
  await page.waitForTimeout(500)

  // 6. Add another tag via API — client receives via WS (rev 2),
  //    detects gap on same stream (expected rev 1, got rev 2)
  await addTagViaApi(request, notebookId, 'trigger-tag', nextRev)

  // 7. Gap repair fetches rev 1 (missed-tag), then processes rev 2 (trigger-tag).
  //    Both tags should appear on the dashboard.
  await expect(page.locator('.dash-notebook-tag', { hasText: 'missed-tag' })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.locator('.dash-notebook-tag', { hasText: 'trigger-tag' })).toBeVisible({
    timeout: 10_000,
  })
})

test('recovers missed events after client network loss', async ({ page, request, mode }) => {
  // 1. Open dashboard with WS → create notebook → verify visible
  await gotoWithWsSubscribed(page, url('/', { mode, ws: true }))

  const createBody = await createNotebookViaApi(request, 'TestNB')
  const notebookId = createBody.id
  let nextRev = createBody.nextExpectedRevision

  await waitForDashNotebookCount(page, 1)

  // 2. Kill WS server-side, then set page offline
  await request.post(`${API}/test/ws-pause`)
  await waitForWsDisconnected(page)
  await page.context().setOffline(true)

  // 3. Add tag via API — client does NOT receive this event (rev 1, missed)
  const tagRes1 = await addTagViaApi(request, notebookId, 'missed-tag', nextRev)
  nextRev = tagRes1.nextExpectedRevision

  // 4. Resume WS server-side, then restore network
  await request.post(`${API}/test/ws-resume`)
  await page.context().setOffline(false)
  await waitForWsReconnection(page)
  await page.waitForTimeout(500)

  // 5. Add another tag via API — client receives via WS (rev 2),
  //    detects gap on same stream (expected rev 1, got rev 2)
  await addTagViaApi(request, notebookId, 'trigger-tag', nextRev)

  // 6. Gap repair fetches rev 1 (missed-tag), then processes rev 2 (trigger-tag).
  await expect(page.locator('.dash-notebook-tags', { hasText: 'missed-tag' })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.locator('.dash-notebook-tags', { hasText: 'trigger-tag' })).toBeVisible({
    timeout: 10_000,
  })
})

/** Create a notebook via API and return its response. */
async function createNotebookViaApi(
  request: APIRequestContext,
  name: string,
): Promise<CommandSuccessResponse> {
  const res = await request.post(`${API}/notebooks/commands`, {
    data: { type: 'CreateNotebook', data: { name } },
  })
  expect(res.ok()).toBe(true)
  return (await res.json()) as CommandSuccessResponse
}

/** Add a tag to a notebook via API. */
async function addTagViaApi(
  request: APIRequestContext,
  id: string,
  tag: string,
  revision: string,
): Promise<CommandSuccessResponse> {
  const res = await request.post(`${API}/notebooks/commands`, {
    data: { type: 'AddNotebookTag', data: { id, tag }, revision },
  })
  expect(res.ok()).toBe(true)
  return (await res.json()) as CommandSuccessResponse
}
