import type { Component } from 'solid-js'
import { For } from 'solid-js'

type PersistenceValue = 'Permanent' | 'Stateful' | 'Anticipated'

const PERSISTENCE_VALUES: PersistenceValue[] = ['Permanent', 'Stateful', 'Anticipated']

interface PersistenceFilterChipsProps {
  active: Set<PersistenceValue>
  onToggle: (value: PersistenceValue) => void
}

export const PersistenceFilterChips: Component<PersistenceFilterChipsProps> = (props) => {
  return (
    <div class="filter-chips">
      <For each={PERSISTENCE_VALUES}>
        {(value) => (
          <button
            class={`filter-chip persistence-chip persistence-${value.toLowerCase()} ${props.active.has(value) ? 'active' : ''}`}
            onClick={() => props.onToggle(value)}
          >
            {value}
          </button>
        )}
      </For>
    </div>
  )
}
