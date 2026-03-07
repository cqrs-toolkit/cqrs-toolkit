import { describe, expect, it } from 'vitest'
import { createStorageStore } from './storage.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ExecFn = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>

function successExec(rows: Record<string, unknown>[]): ExecFn {
  return async () => rows
}

function failExec(message: string): ExecFn {
  return async () => {
    throw new Error(message)
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createStorageStore', () => {
  describe('executeQuery', () => {
    it('success creates result tab and populates data', async () => {
      const store = createStorageStore()
      const rows = [{ id: 1, name: 'alice' }]

      await store.executeQuery('SELECT 1', successExec(rows))

      // New tab created (Query + Query Result)
      expect(store.tabs()).toHaveLength(2)
      expect(store.tabs()[1]?.type).toBe('result')

      // Active tab switched to result
      expect(store.activeTabId()).not.toBe('query')

      // Result data populated
      const data = store.getResultData(store.activeTabId())
      expect(data).toBeDefined()
      expect(data?.rows).toEqual(rows)
      expect(data?.columns).toEqual(['id', 'name'])
    })

    it('error does not create result tab', async () => {
      const store = createStorageStore()

      await store.executeQuery('BAD SQL', failExec('syntax error'))

      expect(store.tabs()).toHaveLength(1)
      expect(store.tabs()[0]?.id).toBe('query')
      expect(store.activeTabId()).toBe('query')
    })

    it('error appends to queryLogs and opens logs panel', async () => {
      const store = createStorageStore()

      await store.executeQuery('BAD SQL', failExec('syntax error near "BAD"'))

      expect(store.queryLogs()).toHaveLength(1)
      expect(store.queryLogs()[0]?.level).toBe('error')
      expect(store.queryLogs()[0]?.message).toContain('syntax error')
      expect(store.logsOpen()).toBe(true)
    })

    it('error preserves existing result tab data', async () => {
      const store = createStorageStore()
      const rows = [{ id: 1 }]

      // First call succeeds — creates result tab
      await store.executeQuery('SELECT 1', successExec(rows))
      const resultTabId = store.activeTabId()

      // Switch back to query tab
      store.setActiveTab('query')

      // Second call fails
      await store.executeQuery('BAD', failExec('fail'))

      // Result tab still exists with original data
      expect(store.tabs()).toHaveLength(2)
      const data = store.getResultData(resultTabId)
      expect(data?.rows).toEqual(rows)
    })

    it('success reuses existing query result tab', async () => {
      const store = createStorageStore()

      await store.executeQuery('SELECT 1', successExec([{ a: 1 }]))
      expect(store.tabs()).toHaveLength(2)

      // Switch back and run another query
      store.setActiveTab('query')
      await store.executeQuery('SELECT 2', successExec([{ b: 2 }]))

      // Still 2 tabs (reused)
      expect(store.tabs()).toHaveLength(2)

      // Data updated to second query
      const data = store.getResultData(store.activeTabId())
      expect(data?.rows).toEqual([{ b: 2 }])
    })
  })

  describe('logs panel controls', () => {
    it('closeLogsPanel hides logs, clearQueryLogs clears entries', async () => {
      const store = createStorageStore()

      // Trigger an error to open logs
      await store.executeQuery('BAD', failExec('fail'))
      expect(store.logsOpen()).toBe(true)
      expect(store.queryLogs()).toHaveLength(1)

      // Close hides but keeps entries
      store.closeLogsPanel()
      expect(store.logsOpen()).toBe(false)
      expect(store.queryLogs()).toHaveLength(1)

      // Clear removes entries
      store.clearQueryLogs()
      expect(store.queryLogs()).toHaveLength(0)
    })

    it('toggleLogsPanel flips logsOpen state', () => {
      const store = createStorageStore()

      expect(store.logsOpen()).toBe(false)
      store.toggleLogsPanel()
      expect(store.logsOpen()).toBe(true)
      store.toggleLogsPanel()
      expect(store.logsOpen()).toBe(false)
    })
  })
})
