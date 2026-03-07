import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import type { CacheKeyEntry } from '../../stores/cache.js'
import { formatJson, formatTimestamp } from '../../utils/format.js'

interface CacheDetailProps {
  entry: CacheKeyEntry
  onClose: () => void
  width: number
}

export const CacheDetail: Component<CacheDetailProps> = (props) => {
  return (
    <div class="cache-detail" style={{ width: `${props.width}px` }}>
      <div class="detail-header">
        <h3>
          {props.entry.collection}
          <span class={`status-badge cache-status-${props.entry.status}`} style="margin-left: 6px">
            {props.entry.status}
          </span>
        </h3>
        <button class="detail-close-btn" onClick={() => props.onClose()} title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708z" />
          </svg>
        </button>
        <div class="meta">{props.entry.key}</div>
      </div>

      <div class="detail-section">
        <h4>Eviction Policy</h4>
        <span>{props.entry.evictionPolicy}</span>
      </div>

      <Show when={props.entry.params}>
        {(params) => (
          <div class="detail-section">
            <h4>Params</h4>
            <pre class="detail-json">{formatJson(params())}</pre>
          </div>
        )}
      </Show>

      <div class="detail-section">
        <h4>Timestamps</h4>
        <div class="meta">
          Acquired: {formatTimestamp(props.entry.acquiredAt)}
          <Show when={props.entry.evictedAt}>
            {(evictedAt) => (
              <>
                <br />
                Evicted: {formatTimestamp(evictedAt())}
              </>
            )}
          </Show>
          <Show when={props.entry.evictionReason}>
            {(reason) => (
              <>
                <br />
                Reason: {reason()}
              </>
            )}
          </Show>
        </div>
      </div>
    </div>
  )
}
