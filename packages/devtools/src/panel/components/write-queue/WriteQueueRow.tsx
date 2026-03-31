import type { Component } from 'solid-js'
import type { WriteQueueEntry } from '../../stores/writeQueue.js'
import { formatTime } from '../../utils/format.js'

interface WriteQueueRowProps {
  entry: WriteQueueEntry
  columns: string
  selected: boolean
  onSelect: () => void
}

export const WriteQueueRow: Component<WriteQueueRowProps> = (props) => {
  return (
    <div
      class={`wq-row ${props.selected ? 'selected' : ''}`}
      style={{ display: 'grid', 'grid-template-columns': props.columns }}
      onClick={() => props.onSelect()}
    >
      <span class="wq-col-time">{formatTime(props.entry.enqueuedAt)}</span>
      <span class="wq-col-id">{props.entry.opId}</span>
      <span class="wq-col-type">{props.entry.opType}</span>
      <span class={`wq-col-status wq-status-${props.entry.status}`}>{props.entry.status}</span>
      <span class="wq-col-duration">
        {typeof props.entry.durationMs === 'number' ? `${props.entry.durationMs}ms` : '—'}
      </span>
    </div>
  )
}
