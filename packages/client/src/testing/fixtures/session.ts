/**
 * Session test fixtures.
 */

import type { SessionRecord } from '../../storage/IStorage.js'

/**
 * Create a test session record.
 *
 * @param overrides - Optional field overrides
 * @returns Session record
 */
export function createTestSession(
  overrides: Partial<Omit<SessionRecord, 'id'>> = {},
): SessionRecord {
  const now = Date.now()
  return {
    id: 1,
    userId: 'test-user-id',
    createdAt: now,
    lastSeenAt: now,
    ...overrides,
  }
}
