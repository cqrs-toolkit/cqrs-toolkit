import type { Component } from 'solid-js'
import type { ReadModelCollectionEntry } from '../../stores/readModels.js'
import { formatTime } from '../../utils/format.js'

interface ReadModelRowProps {
  entry: ReadModelCollectionEntry
  columns: string
  selected: boolean
  onSelect: () => void
}

export const ReadModelRow: Component<ReadModelRowProps> = (props) => {
  return (
    <div
      class={`rm-row ${props.selected ? 'selected' : ''}`}
      style={{ display: 'grid', 'grid-template-columns': props.columns }}
      onClick={() => props.onSelect()}
    >
      <span class="rm-col-collection">{props.entry.collection}</span>
      <span class="rm-col-keys">{props.entry.cacheKeys.size}</span>
      <span class="rm-col-entities">{props.entry.entityIds.size}</span>
      <span class="rm-col-updates">{props.entry.updateCount}</span>
      <span class="rm-col-time">
        {props.entry.lastUpdateAt ? formatTime(props.entry.lastUpdateAt) : '\u2014'}
      </span>
    </div>
  )
}
