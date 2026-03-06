import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { CommandsStore } from '../stores/commands.js'
import { CommandDetail } from './CommandDetail.js'
import { CommandRow } from './CommandRow.js'
import { StatusFilterChips } from './StatusFilterChips.js'

interface CommandsTabProps {
  store: CommandsStore
  onRetry: (commandId: string) => void
  onCancel: (commandId: string) => void
  onRefresh: () => void
  onClear: () => void
}

export const CommandsTab: Component<CommandsTabProps> = (props) => {
  const filtered = () => props.store.filteredCommands()
  const selected = () => props.store.selectedEntry()

  return (
    <>
      <div class="commands-toolbar">
        <StatusFilterChips
          active={props.store.filterStatuses()}
          onToggle={(s) => props.store.toggleFilter(s)}
        />
        <button class="toolbar-btn" onClick={() => props.onRefresh()}>
          Refresh
        </button>
        <button class="toolbar-btn" onClick={() => props.onClear()}>
          Clear
        </button>
        <span class="count">{filtered().length} commands</span>
      </div>

      <div class="commands-layout">
        <Show when={filtered().length > 0} fallback={<div class="empty-state">No commands</div>}>
          <div class="commands-table-wrap">
            <table class="commands-table">
              <thead>
                <tr>
                  <th class="col-id">ID</th>
                  <th class="col-service">Service</th>
                  <th class="col-type">Type</th>
                  <th class="col-status">Status</th>
                  <th class="col-attempts">#</th>
                  <th class="col-time">Time</th>
                </tr>
              </thead>
              <tbody>
                <For each={filtered()}>
                  {(entry) => (
                    <CommandRow
                      command={entry.record}
                      selected={props.store.selectedId() === entry.record.commandId}
                      onSelect={() => props.store.selectCommand(entry.record.commandId)}
                    />
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>

        <Show when={selected()}>
          {(entry) => (
            <CommandDetail
              command={entry().record}
              debugEvents={entry().debugEvents}
              onRetry={() => props.onRetry(entry().record.commandId)}
              onCancel={() => props.onCancel(entry().record.commandId)}
            />
          )}
        </Show>
      </div>
    </>
  )
}
