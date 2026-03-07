import type { Component } from 'solid-js'
import type { CacheKeyEntry } from '../../stores/cache.js'
import { formatTime } from '../../utils/format.js'

interface CacheRowProps {
  entry: CacheKeyEntry
  columns: string
  selected: boolean
  onSelect: () => void
}

export const CacheRow: Component<CacheRowProps> = (props) => {
  return (
    <div
      class={`cache-row ${props.selected ? 'selected' : ''}`}
      style={{ display: 'grid', 'grid-template-columns': props.columns }}
      onClick={() => props.onSelect()}
    >
      <span class="cache-col-key">{props.entry.key.slice(0, 8)}</span>
      <span class="cache-col-collection">{props.entry.collection}</span>
      <span class="cache-col-policy">{props.entry.evictionPolicy.charAt(0).toUpperCase()}</span>
      <span class="cache-col-status">
        <span class={`status-badge cache-status-${props.entry.status}`}>{props.entry.status}</span>
      </span>
      <span class="cache-col-time">{formatTime(props.entry.acquiredAt)}</span>
    </div>
  )
}
