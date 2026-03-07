import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { ResultTabData } from '../../stores/storage.js'
import { ResultRow } from './ResultRow.js'

const TEXT_TYPES = /^(TEXT|VARCHAR|CHAR|CLOB)/i
const NUMERIC_TYPES = /^(REAL|FLOAT|DOUBLE|NUMERIC)/i
const INT_TYPES = /^(INTEGER|INT)/i
const BLOB_TYPE = /^BLOB$/i

function typeBasedMin(type: string | undefined): number {
  if (!type) return 60
  if (INT_TYPES.test(type)) return 60
  if (NUMERIC_TYPES.test(type)) return 80
  if (TEXT_TYPES.test(type)) return 120
  if (BLOB_TYPE.test(type)) return 80
  return 60
}

interface ResultPanelProps {
  data: ResultTabData
  onFilterChange: (text: string) => void
  onNextPage: () => void
  onPrevPage: () => void
}

export const ResultPanel: Component<ResultPanelProps> = (props) => {
  const columnMins = createMemo(() =>
    props.data.columns.map((name) => {
      const nameMin = name.length * 7 + 4
      const typeMin = typeBasedMin(props.data.columnTypes[name])
      return Math.max(nameMin, typeMin)
    }),
  )

  const gridTemplate = createMemo(() => {
    const mins = columnMins()
    if (mins.length === 0) return ''
    return mins.map((min) => `minmax(${min}px, 1fr)`).join(' ')
  })

  const filteredRows = createMemo(() => {
    const filter = props.data.textFilter.toLowerCase()
    if (!filter) return props.data.rows
    return props.data.rows.filter((row) =>
      props.data.columns.some((col) => {
        const val = row[col]
        if (val === null || val === undefined) return false
        return String(val).toLowerCase().includes(filter)
      }),
    )
  })

  const pageStart = () => props.data.page * props.data.pageSize + 1
  const pageEnd = () => pageStart() + filteredRows().length - 1
  const totalLabel = () => {
    if (props.data.totalRows >= 0) {
      return props.data.hasMore ? `${props.data.totalRows}+` : String(props.data.totalRows)
    }
    return '?'
  }

  return (
    <div class="storage-result-panel">
      <Show when={props.data.error}>{(err) => <div class="storage-error">{err()}</div>}</Show>

      <div class="storage-result-toolbar">
        <input
          class="toolbar-input storage-filter-input"
          type="text"
          placeholder="Filter rows..."
          value={props.data.textFilter}
          onInput={(e) => props.onFilterChange(e.currentTarget.value)}
        />
        <span class="storage-pagination">
          <button
            class="toolbar-btn"
            disabled={props.data.page === 0}
            onClick={() => props.onPrevPage()}
          >
            Prev
          </button>
          <span class="storage-row-indicator">
            Rows {pageStart()}-{pageEnd()} of {totalLabel()}
          </span>
          <button
            class="toolbar-btn"
            disabled={!props.data.hasMore}
            onClick={() => props.onNextPage()}
          >
            Next
          </button>
        </span>
      </div>

      <Show when={props.data.columns.length > 0}>
        <div class="storage-result-scroll">
          <div style={{ 'min-width': `${columnMins().reduce((sum, m) => sum + m, 0)}px` }}>
            <div
              class="storage-result-header"
              style={{ display: 'grid', 'grid-template-columns': gridTemplate() }}
            >
              <For each={props.data.columns}>{(col) => <span>{col}</span>}</For>
            </div>
            <Show
              when={filteredRows().length > 0}
              fallback={<div class="empty-state">No rows</div>}
            >
              <div class="storage-result-body">
                <For each={filteredRows()}>
                  {(row) => (
                    <ResultRow
                      columns={props.data.columns}
                      row={row}
                      gridTemplate={gridTemplate()}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
