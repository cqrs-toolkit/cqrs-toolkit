import { test as base } from '@playwright/test'

const test = base.extend<{ mode: string }>({
  mode: ['dedicated-worker', { option: true }],
})

test('debug shared-worker page load', async ({ page, mode }) => {
  const allLogs: string[] = []
  page.on('console', (msg) => allLogs.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', (err) => allLogs.push(`[PAGE ERROR] ${err.message}`))

  await page.goto(`/todos?mode=${mode}&ws=false`)
  await page.waitForTimeout(5000)

  const html = await page.content()
  console.log('PAGE HTML:', html.slice(0, 2000))
  console.log(`--- ALL LOGS (${allLogs.length}) ---`)
  for (const l of allLogs) console.log(l)
  console.log('--- END ALL LOGS ---')
})
