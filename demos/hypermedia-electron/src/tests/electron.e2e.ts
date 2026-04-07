import { assertMode } from '@cqrs-toolkit/hypermedia-base/e2e-helpers'
import { test } from '../e2e-fixtures.js'

test('reports electron execution mode', async ({ page }) => {
  await assertMode(page, 'electron')
})
