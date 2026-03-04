import type { ExecutionMode } from '@cqrs-toolkit/client'
import { test as base } from '@playwright/test'

interface ModeFixtures {
  mode: ExecutionMode
}

export const test = base.extend<ModeFixtures>({
  mode: ['online-only', { option: true }],
})

export { expect } from '@playwright/test'

export function url(path: string, mode: string, ws: boolean): string {
  return `${path}?mode=${mode}&ws=${ws}`
}
