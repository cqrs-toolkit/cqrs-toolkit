import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { getPanelWidth, setPanelWidth } from '../../panelWidths.js'
import type { EventBusStore } from '../../stores/eventBus.js'
import { useContainerWidth } from '../../useContainerWidth.js'
import { DragHandle } from '../DragHandle.js'
import { MultiSelect } from '../MultiSelect.js'
import { VirtualScroller } from '../VirtualScroller.js'
import { EventBusDetail } from './EventBusDetail.js'
import { EventBusRow } from './EventBusRow.js'

const BUS_COLUMNS =
  'minmax(65px, 0.4fr) minmax(150px, 1fr) minmax(45px, 0.3fr) minmax(55px, 0.4fr) minmax(100px, 0.8fr) minmax(120px, 1.5fr)'
const BUS_MIN_WIDTH = '570px'

interface EventBusTabProps {
  store: EventBusStore
  onExport: () => void
  onClear: () => void
}

export const EventBusTab: Component<EventBusTabProps> = (props) => {
  const filtered = () => props.store.filteredEntries()
  const selected = () => props.store.selectedEntry()

  let containerRef: HTMLDivElement | undefined
  const containerWidth = useContainerWidth(() => containerRef)

  let startWidth = 0

  return (
    <>
      <div class="bus-toolbar">
        <MultiSelect
          class="type-selector"
          label="Prefix"
          values={props.store.seenPrefixes()}
          selected={props.store.prefixFilter()}
          onToggle={(v) => props.store.togglePrefixFilter(v)}
          onSelectAll={() => props.store.selectAllPrefixes()}
          onClear={() => props.store.clearPrefixFilter()}
        />
        <MultiSelect
          class="type-selector"
          label="Type"
          values={props.store.seenTypes()}
          selected={props.store.typeFilter()}
          onToggle={(v) => props.store.toggleTypeFilter(v)}
          onSelectAll={() => props.store.selectAllTypes()}
          onClear={() => props.store.clearTypeFilter()}
        />
        <button
          class={`bus-debug-toggle ${props.store.showDebug() ? 'active' : ''}`}
          onClick={() => props.store.setShowDebug(!props.store.showDebug())}
        >
          Debug
        </button>
        <button class="toolbar-btn" onClick={() => props.onExport()}>
          Export
        </button>
        <button class="toolbar-btn" onClick={() => props.onClear()}>
          Clear
        </button>
        <span class="count">{filtered().length} events</span>
      </div>

      <div class="bus-layout" ref={containerRef}>
        <div class="bus-list">
          <div class="bus-scroll-wrap">
            <div style={{ 'min-width': BUS_MIN_WIDTH }}>
              <div
                class="bus-header"
                style={{ display: 'grid', 'grid-template-columns': BUS_COLUMNS }}
              >
                <span>Time</span>
                <span>Type</span>
                <span>Debug</span>
                <span>Kind</span>
                <span>Target</span>
                <span>Data</span>
              </div>
              <Show
                when={filtered().length > 0}
                fallback={<div class="empty-state">No events</div>}
              >
                <VirtualScroller
                  items={filtered}
                  filterVersion={props.store.filterVersion}
                  renderRow={(entry) => (
                    <EventBusRow
                      entry={entry}
                      columns={BUS_COLUMNS}
                      selected={props.store.selectedId() === entry.entryId}
                      onSelect={() => props.store.selectEntry(entry.entryId)}
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
                  startWidth = getPanelWidth('eventBus', containerWidth())
                }}
                onDrag={(delta) => {
                  setPanelWidth('eventBus', startWidth + delta, containerWidth())
                }}
              />
              <EventBusDetail
                entry={entry()}
                onClose={() => props.store.selectEntry(undefined)}
                width={getPanelWidth('eventBus', containerWidth())}
              />
            </>
          )}
        </Show>
      </div>
    </>
  )
}
