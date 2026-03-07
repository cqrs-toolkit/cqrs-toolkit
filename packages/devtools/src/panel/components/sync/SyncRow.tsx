import type { Component, JSX } from 'solid-js'
import type { SyncListItem, SyncLogEntry } from '../../stores/sync.js'
import { formatTime } from '../../utils/format.js'

interface SyncRowProps {
  item: SyncListItem
  columns: string
  selected: boolean
  onSelect: () => void
}

export const SyncRow: Component<SyncRowProps> = (props) => {
  return <>{renderItem(props)}</>
}

function renderItem(props: SyncRowProps): JSX.Element {
  const item = props.item

  switch (item.kind) {
    case 'event':
      return (
        <SyncDataRow
          entry={item.entry}
          columns={props.columns}
          selected={props.selected}
          onSelect={props.onSelect}
        />
      )
    case 'session-divider':
      return (
        <div class="session-divider">
          <hr />
          <span>Session: {item.userId || 'anonymous'}</span>
          <hr />
        </div>
      )
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SyncDataRowProps {
  entry: SyncLogEntry
  columns: string
  selected: boolean
  onSelect: () => void
}

const SyncDataRow: Component<SyncDataRowProps> = (props) => {
  return (
    <div
      class={`sync-row ${props.selected ? 'selected' : ''}`}
      style={{ display: 'grid', 'grid-template-columns': props.columns }}
      onClick={() => props.onSelect()}
    >
      <span class="sync-col-time">{formatTime(props.entry.timestamp)}</span>
      <span class={`sync-col-type sync-type-badge sync-type-${getTypeColor(props.entry)}`}>
        {props.entry.syncType}
      </span>
      <span class="sync-col-scope">{props.entry.scope}</span>
      <span class="sync-col-details">{props.entry.details}</span>
    </div>
  )
}

function getTypeColor(entry: SyncLogEntry): string {
  switch (entry.syncType) {
    case 'sync-failed':
    case 'ws-disconnected':
      return 'error'
    case 'sync-completed':
    case 'ws-connected':
    case 'sync-seed-completed':
    case 'sync-refetch-executed':
      return 'success'
    case 'sync-started':
    case 'ws-connecting':
    case 'sync-refetch-scheduled':
    case 'ws-subscribed':
      return 'info'
    case 'connectivity-changed':
      return entry.details === 'Online' ? 'success' : 'error'
    default:
      return 'neutral'
  }
}
