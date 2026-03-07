import type { Component } from 'solid-js'
import { For } from 'solid-js'

interface StorageTabInfo {
  id: string
  label: string
  closeable: boolean
}

interface StorageTabBarProps {
  tabs: StorageTabInfo[]
  activeTabId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

export const StorageTabBar: Component<StorageTabBarProps> = (props) => {
  return (
    <div class="storage-tab-bar">
      <For each={props.tabs}>
        {(tab) => (
          <button
            class={`storage-tab-btn ${props.activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => props.onSelect(tab.id)}
            onMouseDown={(e) => {
              if (e.button === 1 && tab.closeable) {
                e.preventDefault()
                props.onClose(tab.id)
              }
            }}
          >
            <span>{tab.label}</span>
            {tab.closeable && (
              <span
                class="storage-tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  props.onClose(tab.id)
                }}
              >
                ×
              </span>
            )}
          </button>
        )}
      </For>
    </div>
  )
}
