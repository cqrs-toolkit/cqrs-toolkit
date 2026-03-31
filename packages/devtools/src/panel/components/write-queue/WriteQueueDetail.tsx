import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import type { WriteQueueEntry } from '../../stores/writeQueue.js'
import { formatJson, formatTimestamp } from '../../utils/format.js'

interface WriteQueueDetailProps {
  entry: WriteQueueEntry
  onClose: () => void
  width: number
}

export const WriteQueueDetail: Component<WriteQueueDetailProps> = (props) => {
  return (
    <div class="wq-detail" style={{ width: `${props.width}px` }}>
      <div class="detail-header">
        <h3>{props.entry.opType}</h3>
        <button class="detail-close-btn" onClick={() => props.onClose()} title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708z" />
          </svg>
        </button>
        <div class="meta">
          Op #{props.entry.opId} &middot;{' '}
          <span class={`wq-status-${props.entry.status}`}>{props.entry.status}</span> &middot;{' '}
          {formatTimestamp(props.entry.enqueuedAt)}
          {typeof props.entry.durationMs === 'number' && ` · ${props.entry.durationMs}ms`}
        </div>
      </div>

      <Show when={props.entry.error}>
        {(error) => (
          <div class="detail-section">
            <h4>Error</h4>
            <pre class="detail-json wq-error-text">{error()}</pre>
          </div>
        )}
      </Show>

      <Show when={props.entry.discardReason}>
        {(reason) => (
          <div class="detail-section">
            <h4>Discard Reason</h4>
            <span>{reason()}</span>
          </div>
        )}
      </Show>

      <div class="detail-section">
        <h4>Operation Data</h4>
        <pre class="detail-json">{formatJson(props.entry.data)}</pre>
      </div>
    </div>
  )
}
