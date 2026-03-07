import type { Component } from 'solid-js'
import { For } from 'solid-js'

interface ResultRowProps {
  columns: string[]
  row: Record<string, unknown>
  gridTemplate: string
}

export const ResultRow: Component<ResultRowProps> = (props) => {
  return (
    <div
      class="storage-result-row"
      style={{ display: 'grid', 'grid-template-columns': props.gridTemplate }}
    >
      <For each={props.columns}>
        {(col) => {
          const value = props.row[col]
          return (
            <span class="storage-result-cell" title={formatCellValue(value)}>
              {formatCellDisplay(value, col)}
            </span>
          )
        }}
      </For>
    </div>
  )
}

function formatCellDisplay(value: unknown, column: string): string {
  if (value === null || value === undefined) return 'NULL'
  if (column.endsWith('_at') && typeof value === 'number') {
    return formatTimestamp(value)
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
