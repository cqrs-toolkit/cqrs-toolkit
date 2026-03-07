import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import type { EventEntry, ProcessorResult } from '../../stores/events.js'
import { formatJson, formatTimestamp } from '../../utils/format.js'

interface EventDetailProps {
  entry: EventEntry
  processorResult: ProcessorResult | undefined
  onClose: () => void
  width: number
}

export const EventDetail: Component<EventDetailProps> = (props) => {
  const evt = () => props.entry.event
  const persistenceLabel = () => evt().persistence ?? 'Permanent'

  return (
    <div class="event-detail" style={{ width: `${props.width}px` }}>
      <div class="detail-header">
        <h3>
          {evt().type}
          <span
            class={`persistence-badge persistence-${(evt().persistence ?? 'Permanent').toLowerCase()}`}
            style="margin-left: 6px"
          >
            {persistenceLabel()}
          </span>
        </h3>
        <button class="detail-close-btn" onClick={() => props.onClose()} title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708z" />
          </svg>
        </button>
        <div class="meta">
          Stream: {evt().streamId}
          <br />
          Revision: {evt().revision} &middot; Position: {evt().position}
          <br />
          ID: {evt().id}
          <br />
          Created: {evt().created}
          <br />
          Received: {formatTimestamp(props.entry.timestamp)}
        </div>
      </div>

      <div class="detail-section">
        <h4>Event Data</h4>
        <pre class="detail-json">{formatJson(evt().data)}</pre>
      </div>

      <Show when={evt().metadata && Object.keys(evt().metadata as object).length > 0}>
        <div class="detail-section">
          <h4>Metadata</h4>
          <pre class="detail-json">{formatJson(evt().metadata)}</pre>
        </div>
      </Show>

      <Show when={props.processorResult}>
        {(result) => (
          <div class="detail-section">
            <h4>Processor Results</h4>
            <div class="processor-result">
              <span>Invalidated: {result().invalidated ? 'Yes' : 'No'}</span>
              <Show when={result().updatedIds.length > 0}>
                <div style="margin-top: 4px">
                  <span class="processor-label">Updated read models:</span>
                  <pre class="detail-json">{formatJson(result().updatedIds)}</pre>
                </div>
              </Show>
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}
