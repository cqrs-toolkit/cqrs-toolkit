import type { CommandStatus } from '@cqrs-toolkit/client'
import type { Component } from 'solid-js'
import { For } from 'solid-js'

const STATUSES: CommandStatus[] = [
  'pending',
  'blocked',
  'sending',
  'succeeded',
  'failed',
  'cancelled',
]

interface StatusFilterChipsProps {
  active: Set<CommandStatus>
  onToggle: (status: CommandStatus) => void
}

export const StatusFilterChips: Component<StatusFilterChipsProps> = (props) => {
  return (
    <div class="filter-chips">
      <For each={STATUSES}>
        {(status) => (
          <button
            class={`filter-chip ${props.active.has(status) ? 'active' : ''}`}
            onClick={() => props.onToggle(status)}
          >
            {status}
          </button>
        )}
      </For>
    </div>
  )
}
