import type { Component } from 'solid-js'
import type { SyncLogEntry } from '../../stores/sync.js'
import { formatJson, formatTimestamp } from '../../utils/format.js'

interface SyncDetailProps {
  entry: SyncLogEntry
  onClose: () => void
  width: number
}

export const SyncDetail: Component<SyncDetailProps> = (props) => {
  return (
    <div class="sync-detail" style={{ width: `${props.width}px` }}>
      <div class="detail-header">
        <h3>{props.entry.syncType}</h3>
        <button class="detail-close-btn" onClick={() => props.onClose()} title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708z" />
          </svg>
        </button>
        <div class="meta">
          Scope: {props.entry.scope} &middot; {formatTimestamp(props.entry.timestamp)}
        </div>
      </div>

      <div class="detail-section">
        <h4>Details</h4>
        <span>{props.entry.details}</span>
      </div>

      <div class="detail-section">
        <h4>Payload</h4>
        <pre class="detail-json">{formatJson(props.entry.data)}</pre>
      </div>
    </div>
  )
}
