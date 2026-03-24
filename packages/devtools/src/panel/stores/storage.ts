/**
 * Storage explorer store — table tree, tab management, query execution, result state.
 */

import { createSignal } from 'solid-js'
import type { TreeStore } from './tree.js'
import { createTreeStore } from './tree.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TableInfo {
  name: string
  ddl: string
  columns: string[]
  columnTypes: Record<string, string>
}

interface StorageTabQuery {
  type: 'query'
  id: 'query'
  label: 'Query'
}

interface StorageTabResult {
  type: 'result'
  id: string
  label: string
}

interface StorageTabDdl {
  type: 'ddl'
  id: string
  table: string
  ddl: string
}

type StorageTab = StorageTabQuery | StorageTabResult | StorageTabDdl

export interface ResultTabData {
  columns: string[]
  columnTypes: Record<string, string>
  rows: Record<string, unknown>[]
  totalRows: number
  page: number
  pageSize: number
  hasMore: boolean
  textFilter: string
  error: string | undefined
  sql: string
}

type ExecFn = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>

export interface QueryLogEntry {
  timestamp: number
  level: 'error' | 'info'
  message: string
}

export interface StorageStore {
  // Table tree
  tables: () => TableInfo[]
  schema: () => Record<string, string[]>
  treeStore: TreeStore
  loadTables: (exec: ExecFn) => Promise<void>
  unavailable: () => boolean

  // Tabs
  tabs: () => StorageTab[]
  activeTabId: () => string
  setActiveTab: (id: string) => void
  closeTab: (id: string) => void

  // Table results
  openTableTab: (table: string, exec: ExecFn) => Promise<void>
  getResultData: (tabId: string) => ResultTabData | undefined
  setFilter: (tabId: string, text: string) => void
  nextPage: (tabId: string, exec: ExecFn) => Promise<void>
  prevPage: (tabId: string, exec: ExecFn) => Promise<void>

  // Query writer
  queryText: () => string
  setQueryText: (text: string) => void
  executeQuery: (sql: string, exec: ExecFn) => Promise<void>
  queryLogs: () => QueryLogEntry[]
  logsOpen: () => boolean
  closeLogsPanel: () => void
  clearQueryLogs: () => void
  toggleLogsPanel: () => void

  // DDL
  openDdlTab: (table: string) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 500

const QUERY_TAB: StorageTabQuery = { type: 'query', id: 'query', label: 'Query' }

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createStorageStore(): StorageStore {
  const [tables, setTables] = createSignal<TableInfo[]>([])
  const treeStore = createTreeStore()
  const [unavailable, setUnavailable] = createSignal(false)

  const [tabs, setTabs] = createSignal<StorageTab[]>([QUERY_TAB])
  const [activeTabId, setActiveTabId] = createSignal<string>('query')

  const [resultData, setResultData] = createSignal<Map<string, ResultTabData>>(new Map())
  const [queryResultTabId, setQueryResultTabId] = createSignal<string | undefined>()
  const [queryText, setQueryText] = createSignal('')
  const [queryLogs, setQueryLogs] = createSignal<QueryLogEntry[]>([])
  const [logsOpen, setLogsOpen] = createSignal(false)

  function updateResultData(tabId: string, data: ResultTabData): void {
    const next = new Map(resultData())
    next.set(tabId, data)
    setResultData(next)
  }

  function removeResultData(tabId: string): void {
    const next = new Map(resultData())
    next.delete(tabId)
    setResultData(next)
  }

  async function loadTables(exec: ExecFn): Promise<void> {
    try {
      const rows = await exec(
        "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      const tableInfos: TableInfo[] = await Promise.all(
        rows.map(async (row) => {
          const name = row['name'] as string
          const pragmaRows = await exec(`PRAGMA table_info("${name}")`)
          const columns = pragmaRows.map((r) => r['name'] as string)
          const columnTypes: Record<string, string> = {}
          for (const r of pragmaRows) {
            const colName = r['name'] as string
            const colType = r['type'] as string
            columnTypes[colName] = colType
          }
          return { name, ddl: (row['sql'] as string) ?? '', columns, columnTypes }
        }),
      )
      setTables(tableInfos)
      treeStore.reconcile(tableInfos.map((t) => t.name))
      setUnavailable(false)
    } catch {
      setUnavailable(true)
    }
  }

  function closeTab(id: string): void {
    if (id === 'query') return
    setTabs(tabs().filter((t) => t.id !== id))
    removeResultData(id)
    if (activeTabId() === id) {
      setActiveTabId('query')
    }
    // Clear query result tab reference if closed
    if (queryResultTabId() === id) {
      setQueryResultTabId(undefined)
    }
  }

  async function openTableTab(table: string, exec: ExecFn): Promise<void> {
    const tabId = `table:${table}`

    // Focus existing tab
    const existing = tabs().find((t) => t.id === tabId)
    if (existing) {
      setActiveTabId(tabId)
      return
    }

    // Create tab
    const newTab: StorageTabResult = { type: 'result', id: tabId, label: table }
    setTabs([...tabs(), newTab])
    setActiveTabId(tabId)

    // Look up column types from loaded tables
    const tableInfo = tables().find((t) => t.name === table)
    const columnTypes = tableInfo?.columnTypes ?? {}

    // Query table
    try {
      const countRows = await exec(`SELECT COUNT(*) as cnt FROM "${table}"`)
      const totalRows = (countRows[0]?.['cnt'] as number) ?? -1
      const rows = await exec(`SELECT * FROM "${table}" LIMIT ${PAGE_SIZE}`)
      const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : []

      const data: ResultTabData = {
        columns,
        columnTypes,
        rows,
        totalRows,
        page: 0,
        pageSize: PAGE_SIZE,
        hasMore: rows.length >= PAGE_SIZE,
        textFilter: '',
        error: undefined,
        sql: `SELECT * FROM "${table}"`,
      }
      updateResultData(tabId, data)
    } catch (err) {
      const data: ResultTabData = {
        columns: [],
        columnTypes,
        rows: [],
        totalRows: 0,
        page: 0,
        pageSize: PAGE_SIZE,
        hasMore: false,
        textFilter: '',
        error: err instanceof Error ? err.message : String(err),
        sql: `SELECT * FROM "${table}"`,
      }
      updateResultData(tabId, data)
    }
  }

  function getResultData(tabId: string): ResultTabData | undefined {
    return resultData().get(tabId)
  }

  function setFilter(tabId: string, text: string): void {
    const current = resultData().get(tabId)
    if (!current) return
    updateResultData(tabId, { ...current, textFilter: text })
  }

  async function nextPage(tabId: string, exec: ExecFn): Promise<void> {
    const current = resultData().get(tabId)
    if (!current || !current.hasMore) return

    const nextPageNum = current.page + 1
    const offset = nextPageNum * PAGE_SIZE
    try {
      const rows = await exec(`${current.sql} LIMIT ${PAGE_SIZE} OFFSET ${offset}`)
      const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : current.columns
      updateResultData(tabId, {
        ...current,
        columns,
        rows,
        page: nextPageNum,
        hasMore: rows.length >= PAGE_SIZE,
      })
    } catch (err) {
      updateResultData(tabId, {
        ...current,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function prevPage(tabId: string, exec: ExecFn): Promise<void> {
    const current = resultData().get(tabId)
    if (!current || current.page === 0) return

    const prevPageNum = current.page - 1
    const offset = prevPageNum * PAGE_SIZE
    try {
      const rows = await exec(`${current.sql} LIMIT ${PAGE_SIZE} OFFSET ${offset}`)
      const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : current.columns
      updateResultData(tabId, {
        ...current,
        columns,
        rows,
        page: prevPageNum,
        hasMore: true,
      })
    } catch (err) {
      updateResultData(tabId, {
        ...current,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function executeQuery(sql: string, exec: ExecFn): Promise<void> {
    let tabId = queryResultTabId()

    // If tab was closed, clear the reference
    if (tabId && !tabs().find((t) => t.id === tabId)) {
      tabId = undefined
      setQueryResultTabId(undefined)
    }

    try {
      const rows = await exec(sql)
      const columns = rows.length > 0 ? Object.keys(rows[0] ?? {}) : []

      // Create or reuse result tab (only on success)
      if (!tabId) {
        tabId = `query-result:${crypto.randomUUID()}`
        setQueryResultTabId(tabId)
        const newTab: StorageTabResult = { type: 'result', id: tabId, label: 'Query Result' }
        setTabs([...tabs(), newTab])
      }

      setActiveTabId(tabId)

      const data: ResultTabData = {
        columns,
        columnTypes: {},
        rows,
        totalRows: -1,
        page: 0,
        pageSize: PAGE_SIZE,
        hasMore: false,
        textFilter: '',
        error: undefined,
        sql,
      }
      updateResultData(tabId, data)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      setQueryLogs([...queryLogs(), { timestamp: Date.now(), level: 'error', message: errorMsg }])
      setLogsOpen(true)
      // Do NOT create/update result tab — preserve last output
    }
  }

  function closeLogsPanel(): void {
    setLogsOpen(false)
  }

  function clearQueryLogs(): void {
    setQueryLogs([])
  }

  function toggleLogsPanel(): void {
    setLogsOpen(!logsOpen())
  }

  function openDdlTab(table: string): void {
    const tabId = `ddl:${table}`

    // Focus existing tab
    const existing = tabs().find((t) => t.id === tabId)
    if (existing) {
      setActiveTabId(tabId)
      return
    }

    // Find DDL from loaded tables
    const tableInfo = tables().find((t) => t.name === table)
    if (!tableInfo) return

    const newTab: StorageTabDdl = { type: 'ddl', id: tabId, table, ddl: tableInfo.ddl }
    setTabs([...tabs(), newTab])
    setActiveTabId(tabId)
  }

  function schema(): Record<string, string[]> {
    const result: Record<string, string[]> = {}
    for (const table of tables()) {
      result[table.name] = table.columns
    }
    return result
  }

  return {
    tables,
    schema,
    treeStore,
    loadTables,
    unavailable,

    tabs,
    activeTabId,
    setActiveTab: setActiveTabId,
    closeTab,

    openTableTab,
    getResultData,
    setFilter,
    nextPage,
    prevPage,

    queryText,
    setQueryText,
    executeQuery,
    queryLogs,
    logsOpen,
    closeLogsPanel,
    clearQueryLogs,
    toggleLogsPanel,

    openDdlTab,
  }
}
