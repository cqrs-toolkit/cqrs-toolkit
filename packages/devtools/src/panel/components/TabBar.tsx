import type { Component } from 'solid-js'
import { For } from 'solid-js'

const TABS = ['Commands', 'Events', 'Cache', 'Read Models', 'Sync', 'Storage'] as const

export type TabName = (typeof TABS)[number]

interface TabBarProps {
  active: TabName
  onSelect: (tab: TabName) => void
}

export const TabBar: Component<TabBarProps> = (props) => {
  return (
    <div class="tab-bar">
      <For each={TABS}>
        {(tab) => (
          <button
            class={`tab-btn ${props.active === tab ? 'active' : ''}`}
            onClick={() => props.onSelect(tab)}
          >
            {tab}
          </button>
        )}
      </For>
    </div>
  )
}
