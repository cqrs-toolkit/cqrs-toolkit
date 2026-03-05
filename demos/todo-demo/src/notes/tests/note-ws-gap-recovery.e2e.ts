import type { CommandSuccessResponse } from '../../../shared/types'
import { expect, test, url } from '../../e2e-fixtures'
import {
  getDashNoteTexts,
  gotoWithWsSubscribed,
  waitForDashNoteCount,
  waitForWsReconnection,
} from '../../e2e-helpers'

const API = 'http://localhost:3001/api'

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/test/reset`)
})

test('client self-recovers missed events after WS gap', async ({ page, request, mode }) => {
  // 1. Open dashboard with WS subscription
  await gotoWithWsSubscribed(page, url('/', { mode, ws: true }))

  // 2. Create a note via API — dashboard receives NoteCreated via WS
  const createRes = await request.post(`${API}/notes/commands`, {
    data: { type: 'CreateNote', payload: { title: 'Original', body: '' } },
  })
  expect(createRes.ok()).toBe(true)
  const createBody = (await createRes.json()) as CommandSuccessResponse
  const noteId = createBody.id
  const revAfterCreate = createBody.nextExpectedRevision

  // 3. Verify dashboard shows the note
  await waitForDashNoteCount(page, 1)
  expect(await getDashNoteTexts(page)).toEqual(['Original'])

  // 4. Go offline — WS drops, page misses subsequent events
  await page.context().setOffline(true)

  // 5. Update note title via API — page does NOT receive this event
  const updateRes = await request.post(`${API}/notes/commands`, {
    data: {
      type: 'UpdateNoteTitle',
      payload: { id: noteId, title: 'Recovered', revision: revAfterCreate },
    },
  })
  expect(updateRes.ok()).toBe(true)
  const updateBody = (await updateRes.json()) as CommandSuccessResponse
  const revAfterTitle = updateBody.nextExpectedRevision

  // 6. Set up WS reconnection listener BEFORE going online
  const reconnected = waitForWsReconnection(page)

  // 7. Go online — WS reconnects
  await page.context().setOffline(false)

  // 8. Wait for WS reconnection (subscribed ack)
  await reconnected

  // 9. Update note body via API — page receives this via WS
  const bodyRes = await request.post(`${API}/notes/commands`, {
    data: {
      type: 'UpdateNoteBody',
      payload: { id: noteId, body: 'some body', revision: revAfterTitle },
    },
  })
  expect(bodyRes.ok()).toBe(true)

  // 10. Page detects gap (has revision from create but missed the title update)
  //     and should fetch the missing event from the server.
  //     Assert dashboard title is "Recovered" — proves the missed event was applied.
  await expect(page.locator('.dash-note-title', { hasText: 'Recovered' })).toBeVisible({
    timeout: 5000,
  })

  // 11. Create another note via API — verify dashboard still receives WS events
  const secondRes = await request.post(`${API}/notes/commands`, {
    data: { type: 'CreateNote', payload: { title: 'After-Gap', body: '' } },
  })
  expect(secondRes.ok()).toBe(true)

  await waitForDashNoteCount(page, 2)
  expect(await getDashNoteTexts(page)).toContain('After-Gap')
})
