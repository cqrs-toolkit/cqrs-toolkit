import type { CommandSuccessResponse } from '../../../shared/types'
import { expect, test, url } from '../../e2e-fixtures'
import {
  getDashNoteTexts,
  gotoWithWsSubscribed,
  waitForDashNoteCount,
  waitForWsDisconnected,
  waitForWsReconnection,
} from '../../e2e-helpers'

const API = 'http://localhost:3001/api'

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/test/reset`)
})

test('recovers missed events after server WS outage', async ({ page, request }) => {
  // 1. Open dashboard with WS → create note → verify visible
  await gotoWithWsSubscribed(page, url('/', { mode: 'online-only', ws: true }))

  const createRes = await request.post(`${API}/notes/commands`, {
    data: { type: 'CreateNote', payload: { title: 'Original', body: '' } },
  })
  expect(createRes.ok()).toBe(true)
  const createBody = (await createRes.json()) as CommandSuccessResponse
  const noteId = createBody.id
  const revAfterCreate = createBody.nextExpectedRevision

  await waitForDashNoteCount(page, 1)
  expect(await getDashNoteTexts(page)).toEqual(['Original'])

  // 2. Kill WS server-side — client misses subsequent events
  await request.post(`${API}/test/ws-pause`)
  await waitForWsDisconnected(page)

  // 3. Update note title via API — client does NOT receive this event
  const updateRes = await request.post(`${API}/notes/commands`, {
    data: {
      type: 'UpdateNoteTitle',
      payload: { id: noteId, title: 'Recovered', revision: revAfterCreate },
    },
  })
  expect(updateRes.ok()).toBe(true)
  const updateBody = (await updateRes.json()) as CommandSuccessResponse
  const revAfterTitle = updateBody.nextExpectedRevision

  // 4. Resume WS server-side — client reconnects via 5s timer
  await request.post(`${API}/test/ws-resume`)
  await waitForWsReconnection(page)

  // 5. Update note body via API — client receives via WS, detects revision gap
  const bodyRes = await request.post(`${API}/notes/commands`, {
    data: {
      type: 'UpdateNoteBody',
      payload: { id: noteId, body: 'some body', revision: revAfterTitle },
    },
  })
  expect(bodyRes.ok()).toBe(true)

  // 6. Gap detection triggers fetch of missing events — title should update
  await expect(page.locator('.dash-note-title', { hasText: 'Recovered' })).toBeVisible({
    timeout: 10_000,
  })

  // 7. Verify WS still works — create another note
  const secondRes = await request.post(`${API}/notes/commands`, {
    data: { type: 'CreateNote', payload: { title: 'After-Gap', body: '' } },
  })
  expect(secondRes.ok()).toBe(true)

  await waitForDashNoteCount(page, 2)
  expect(await getDashNoteTexts(page)).toContain('After-Gap')
})

test('recovers missed events after client network loss', async ({ page, request, mode }) => {
  // 1. Open dashboard with WS → create note → verify visible
  await gotoWithWsSubscribed(page, url('/', { mode, ws: true }))

  const createRes = await request.post(`${API}/notes/commands`, {
    data: { type: 'CreateNote', payload: { title: 'Original', body: '' } },
  })
  expect(createRes.ok()).toBe(true)
  const createBody = (await createRes.json()) as CommandSuccessResponse
  const noteId = createBody.id
  const revAfterCreate = createBody.nextExpectedRevision

  await waitForDashNoteCount(page, 1)
  expect(await getDashNoteTexts(page)).toEqual(['Original'])

  // 2. Kill WS server-side, then set page offline
  //    Order matters: ws-pause before setOffline so the server is ready
  //    to reject before any reconnect attempt triggered by the offline event.
  await request.post(`${API}/test/ws-pause`)
  await waitForWsDisconnected(page)
  await page.context().setOffline(true)

  // 3. Update note title via API — client does NOT receive this event
  const updateRes = await request.post(`${API}/notes/commands`, {
    data: {
      type: 'UpdateNoteTitle',
      payload: { id: noteId, title: 'Recovered', revision: revAfterCreate },
    },
  })
  expect(updateRes.ok()).toBe(true)
  const updateBody = (await updateRes.json()) as CommandSuccessResponse
  const revAfterTitle = updateBody.nextExpectedRevision

  // 4. Resume WS server-side, then restore network
  //    Order matters: ws-resume before setOffline(false) so the server
  //    is accepting before the `online` event triggers an immediate reconnect.
  await request.post(`${API}/test/ws-resume`)
  await page.context().setOffline(false)

  // Online-only: `online` event → immediate reconnect
  // Worker modes: `setOffline` doesn't affect worker, falls back to 5s timer
  await waitForWsReconnection(page)

  // 5. Update note body via API — client receives via WS, detects revision gap
  const bodyRes = await request.post(`${API}/notes/commands`, {
    data: {
      type: 'UpdateNoteBody',
      payload: { id: noteId, body: 'some body', revision: revAfterTitle },
    },
  })
  expect(bodyRes.ok()).toBe(true)

  // 6. Gap detection triggers fetch of missing events — title should update
  await expect(page.locator('.dash-note-title', { hasText: 'Recovered' })).toBeVisible({
    timeout: 10_000,
  })

  // 7. Verify WS still works — create another note
  const secondRes = await request.post(`${API}/notes/commands`, {
    data: { type: 'CreateNote', payload: { title: 'After-Gap', body: '' } },
  })
  expect(secondRes.ok()).toBe(true)

  await waitForDashNoteCount(page, 2)
  expect(await getDashNoteTexts(page)).toContain('After-Gap')
})
