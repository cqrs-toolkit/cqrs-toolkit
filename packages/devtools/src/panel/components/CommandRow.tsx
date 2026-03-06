import type { Component } from 'solid-js'
import type { SerializedCommandRecord } from '../../shared/protocol.js'

interface CommandRowProps {
  command: SerializedCommandRecord
  selected: boolean
  onSelect: () => void
}

export const CommandRow: Component<CommandRowProps> = (props) => {
  return (
    <tr class={`command-row ${props.selected ? 'selected' : ''}`} onClick={() => props.onSelect()}>
      <td class="col-id">
        <span class="command-id">{props.command.commandId.slice(0, 8)}</span>
      </td>
      <td class="col-service">{props.command.service}</td>
      <td class="col-type">
        <span class="command-type">{props.command.type}</span>
      </td>
      <td class="col-status">
        <span class={`status-badge status-${props.command.status}`}>{props.command.status}</span>
      </td>
      <td class="col-attempts">{props.command.attempts}</td>
      <td class="col-time">
        <span class="command-time">{formatTime(props.command.createdAt)}</span>
      </td>
    </tr>
  )
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
