import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { ReadModelCollectionEntry } from '../../stores/readModels.js'
import { formatJson, formatTimestamp } from '../../utils/format.js'

interface ReadModelDetailProps {
  entry: ReadModelCollectionEntry
  onClose: () => void
  width: number
}

export const ReadModelDetail: Component<ReadModelDetailProps> = (props) => {
  return (
    <div class="rm-detail" style={{ width: `${props.width}px` }}>
      <div class="detail-header">
        <h3>{props.entry.collection}</h3>
        <button class="detail-close-btn" onClick={() => props.onClose()} title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708z" />
          </svg>
        </button>
        <div class="meta">
          {props.entry.cacheKeys.size} cache keys, {props.entry.entityIds.size} entities,{' '}
          {props.entry.updateCount} updates
        </div>
      </div>

      <Show when={props.entry.cacheKeys.size > 0}>
        <div class="detail-section">
          <h4>Cache Keys</h4>
          <ul class="dep-list">
            <For each={Array.from(props.entry.cacheKeys).sort()}>{(key) => <li>{key}</li>}</For>
          </ul>
        </div>
      </Show>

      <Show when={props.entry.entityIds.size > 0}>
        <div class="detail-section">
          <h4>Entity IDs</h4>
          <pre class="detail-json">{formatJson(Array.from(props.entry.entityIds).sort())}</pre>
        </div>
      </Show>

      <Show when={props.entry.updateHistory.length > 0}>
        <div class="detail-section">
          <h4>Update History</h4>
          <ul class="debug-timeline">
            <For each={props.entry.updateHistory}>
              {(update) => (
                <li>
                  <span class="event-time">{formatTimestamp(update.timestamp)}</span>
                  {' \u2014 '}
                  {update.ids.length} {update.ids.length === 1 ? 'entity' : 'entities'}
                  <Show when={update.ids.length > 0}>
                    <pre class="detail-json" style="margin-top: 2px">
                      {formatJson(update.ids)}
                    </pre>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  )
}
