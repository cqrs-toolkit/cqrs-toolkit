import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { SerializedCommandRecord } from '../../shared/protocol.js'
import type { DebugEvent } from '../stores/commands.js'
import { DependencyList } from './DependencyList.js'

interface CommandDetailProps {
  command: SerializedCommandRecord
  debugEvents: DebugEvent[]
  onRetry: () => void
  onCancel: () => void
}

export const CommandDetail: Component<CommandDetailProps> = (props) => {
  const canRetry = () => props.command.status === 'failed'
  const canCancel = () => props.command.status === 'pending' || props.command.status === 'blocked'

  return (
    <div class="command-detail">
      <div class="detail-header">
        <h3>
          {props.command.type}
          <span class={`status-badge status-${props.command.status}`} style="margin-left: 6px">
            {props.command.status}
          </span>
        </h3>
        <div class="meta">
          {props.command.commandId} &middot; {props.command.service} &middot;{' '}
          {props.command.attempts} attempt{props.command.attempts !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Payload */}
      <div class="detail-section">
        <h4>Payload</h4>
        <pre class="detail-json">{formatJson(props.command.payload)}</pre>
      </div>

      {/* Error */}
      <Show when={props.command.error}>
        {(error) => (
          <div class="detail-section">
            <h4>Error ({error().source})</h4>
            <pre class="detail-json">{error().message}</pre>
            <Show when={error().details}>
              <pre class="detail-json" style="margin-top: 4px">
                {formatJson(error().details)}
              </pre>
            </Show>
          </div>
        )}
      </Show>

      {/* Server Response */}
      <Show when={props.command.serverResponse !== undefined}>
        <div class="detail-section">
          <h4>Server Response</h4>
          <pre class="detail-json">{formatJson(props.command.serverResponse)}</pre>
        </div>
      </Show>

      {/* Dependencies */}
      <DependencyList dependsOn={props.command.dependsOn} blockedBy={props.command.blockedBy} />

      {/* Debug Events */}
      <Show when={props.debugEvents.length > 0}>
        <div class="detail-section">
          <h4>Debug Events</h4>
          <ul class="debug-timeline">
            <For each={props.debugEvents}>
              {(evt) => (
                <li>
                  <span class="event-type">{evt.type}</span>
                  <span class="event-time">{formatTimestamp(evt.timestamp)}</span>
                  <Show when={Object.keys(evt.payload).length > 0}>
                    <pre class="detail-json" style="margin-top: 2px">
                      {formatJson(evt.payload)}
                    </pre>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>

      {/* Actions */}
      <Show when={canRetry() || canCancel()}>
        <div class="detail-actions">
          <Show when={canRetry()}>
            <button class="btn btn-primary" onClick={() => props.onRetry()}>
              Retry
            </button>
          </Show>
          <Show when={canCancel()}>
            <button class="btn btn-danger" onClick={() => props.onCancel()}>
              Cancel
            </button>
          </Show>
        </div>
      </Show>
    </div>
  )
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}
