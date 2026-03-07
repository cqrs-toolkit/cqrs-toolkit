import type { CommandStatus } from '@cqrs-toolkit/client'
import type { Page } from '@playwright/test'
import { sendToPanel } from './fixtures.js'

// ---------------------------------------------------------------------------
// Inline protocol types (devtools package has no exports)
// ---------------------------------------------------------------------------

export interface SerializedConfig {
  debug: boolean
  retainTerminal: boolean
  network: { baseUrl: string; wsUrl?: string; timeout?: number }
  storage: { dbName?: string }
  retry: { maxAttempts?: number; initialDelay?: number; maxDelay?: number }
  cache: { maxCacheKeys?: number; defaultTtl?: number; evictionPolicy?: string }
  collections: string[]
}

export interface SerializedCommandRecord {
  commandId: string
  service: string
  type: string
  payload: unknown
  status: CommandStatus
  dependsOn: string[]
  blockedBy: string[]
  attempts: number
  lastAttemptAt?: number
  error?: { source: string; message: string; code?: string; details?: unknown }
  serverResponse?: unknown
  createdAt: number
  updatedAt: number
}

export interface SanitizedEvent {
  type: string
  payload: Record<string, unknown>
  timestamp: number
}

export interface BufferDumpMessage {
  type: 'buffer-dump'
  config: SerializedConfig | undefined
  role: 'leader' | 'standby' | undefined
  events: SanitizedEvent[]
  commands: SerializedCommandRecord[]
}

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

export const MOCK_CONFIG: SerializedConfig = {
  debug: true,
  retainTerminal: false,
  network: { baseUrl: 'http://localhost:3001' },
  storage: { dbName: 'test-db' },
  retry: { maxAttempts: 3 },
  cache: {},
  collections: ['todos'],
}

let idCounter = 0

export function resetIdCounter(): void {
  idCounter = 0
}

export function makeCommand(
  overrides: Partial<SerializedCommandRecord> = {},
): SerializedCommandRecord {
  const id = `cmd-${++idCounter}`
  return {
    commandId: id,
    service: 'todos',
    type: 'CreateTodo',
    payload: { text: 'Test todo' },
    status: 'pending',
    dependsOn: [],
    blockedBy: [],
    attempts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

export function makeBufferDump(overrides: Partial<BufferDumpMessage> = {}): BufferDumpMessage {
  return {
    type: 'buffer-dump',
    config: undefined,
    role: undefined,
    events: [],
    commands: [],
    ...overrides,
  }
}

export function makeEvent(type: string, payload: Record<string, unknown>): SanitizedEvent {
  return { type, payload, timestamp: Date.now() }
}

// ---------------------------------------------------------------------------
// Tab navigation helper
// ---------------------------------------------------------------------------

export async function switchTab(page: Page, tabName: string): Promise<void> {
  // Send initial buffer-dump with config so the panel is in connected state
  await sendToPanel(page, makeBufferDump({ config: MOCK_CONFIG, role: 'leader' }))

  // Click the tab button with the matching text
  await page.locator('.tab-btn', { hasText: tabName }).click()
}
