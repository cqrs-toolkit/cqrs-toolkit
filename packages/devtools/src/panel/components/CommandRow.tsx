import type { Component } from 'solid-js'
import type { SerializedCommandRecord } from '../../shared/protocol.js'
import { formatTime } from '../utils/format.js'

interface CommandRowProps {
  command: SerializedCommandRecord
  columns: string
  selected: boolean
  onSelect: () => void
}

export const CommandRow: Component<CommandRowProps> = (props) => {
  return (
    <div
      class={`command-row ${props.selected ? 'selected' : ''}`}
      style={{ display: 'grid', 'grid-template-columns': props.columns }}
      onClick={() => props.onSelect()}
    >
      <span class="cmd-col-id command-id">{props.command.commandId.slice(0, 8)}</span>
      <span class="cmd-col-service">{props.command.service}</span>
      <span class="cmd-col-type command-type">{props.command.type}</span>
      <span class="cmd-col-status">
        <span class={`status-badge status-${props.command.status}`}>{props.command.status}</span>
      </span>
      <span class="cmd-col-attempts">{props.command.attempts}</span>
      <span class="cmd-col-time command-time">{formatTime(props.command.createdAt)}</span>
    </div>
  )
}
