import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { StorageStore } from '../../stores/storage.js'

interface TableTreeProps {
  store: StorageStore
  onOpenTable: (table: string) => void
  onOpenDdl: (table: string) => void
}

export const TableTree: Component<TableTreeProps> = (props) => {
  return (
    <div class="storage-tree">
      <div class="storage-tree-header">Tables</div>
      <div class="storage-tree-list">
        <For each={props.store.tables()}>
          {(table) => {
            const expanded = () => props.store.expandedTable() === table.name

            return (
              <div class="storage-tree-item">
                <div
                  class={`storage-tree-name ${expanded() ? 'expanded' : ''}`}
                  onDblClick={() => props.onOpenTable(table.name)}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault()
                      props.onOpenDdl(table.name)
                    }
                  }}
                >
                  <span
                    class="storage-tree-arrow"
                    onClick={(e) => {
                      e.stopPropagation()
                      props.store.toggleTable(table.name)
                    }}
                  >
                    {expanded() ? '\u25BE' : '\u25B8'}
                  </span>
                  {table.name}
                </div>
                <Show when={expanded()}>
                  <div class="storage-tree-action" onDblClick={() => props.onOpenDdl(table.name)}>
                    Schema
                  </div>
                </Show>
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}
