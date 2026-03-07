import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { getPanelWidth, setPanelWidth } from '../panelWidths.js'
import type { CommandsStore } from '../stores/commands.js'
import { useContainerWidth } from '../useContainerWidth.js'
import { CommandDetail } from './CommandDetail.js'
import { CommandRow } from './CommandRow.js'
import { DragHandle } from './DragHandle.js'
import { StatusFilterChips } from './StatusFilterChips.js'
import { VirtualScroller } from './VirtualScroller.js'

const COMMANDS_COLUMNS =
  'minmax(65px, 1fr) minmax(70px, 1fr) minmax(120px, 1.5fr) minmax(90px, 1fr) minmax(45px, 0.5fr) minmax(75px, 1fr)'
const COMMANDS_MIN_WIDTH = '525px'

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

  let containerRef: HTMLDivElement | undefined
  const containerWidth = useContainerWidth(() => containerRef)

  let startWidth = 0

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

      <div class="commands-layout" ref={containerRef}>
        <div class="commands-list">
          <div class="commands-scroll-wrap">
            <div style={{ 'min-width': COMMANDS_MIN_WIDTH }}>
              <div
                class="commands-header"
                style={{ display: 'grid', 'grid-template-columns': COMMANDS_COLUMNS }}
              >
                <span>ID</span>
                <span>Service</span>
                <span>Type</span>
                <span>Status</span>
                <span style={{ 'text-align': 'right' }}>Tries</span>
                <span>Time</span>
              </div>
              <Show
                when={filtered().length > 0}
                fallback={<div class="empty-state">No commands</div>}
              >
                <VirtualScroller
                  items={filtered}
                  filterVersion={props.store.filterVersion}
                  renderRow={(entry) => (
                    <CommandRow
                      command={entry.record}
                      columns={COMMANDS_COLUMNS}
                      selected={props.store.selectedId() === entry.record.commandId}
                      onSelect={() => props.store.selectCommand(entry.record.commandId)}
                    />
                  )}
                />
              </Show>
            </div>
          </div>
        </div>

        <Show when={selected()}>
          {(entry) => (
            <>
              <DragHandle
                onDragStart={() => {
                  startWidth = getPanelWidth('commands', containerWidth())
                }}
                onDrag={(delta) => {
                  setPanelWidth('commands', startWidth + delta, containerWidth())
                }}
              />
              <CommandDetail
                command={entry().record}
                debugEvents={entry().debugEvents}
                onClose={() => props.store.selectCommand(undefined)}
                onRetry={() => props.onRetry(entry().record.commandId)}
                onCancel={() => props.onCancel(entry().record.commandId)}
                width={getPanelWidth('commands', containerWidth())}
              />
            </>
          )}
        </Show>
      </div>
    </>
  )
}
