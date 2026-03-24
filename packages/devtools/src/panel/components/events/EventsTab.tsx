import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { getPanelWidth, setPanelWidth } from '../../panelWidths.js'
import type { EventsStore } from '../../stores/events.js'
import { useContainerWidth } from '../../useContainerWidth.js'
import { ChipSelect } from '../ChipSelect.js'
import { DragHandle } from '../DragHandle.js'
import { MultiSelect } from '../MultiSelect.js'
import { VirtualScroller } from '../VirtualScroller.js'
import { EventDetail } from './EventDetail.js'
import { EventRow } from './EventRow.js'

const EVENTS_COLUMNS =
  'minmax(70px, 1fr) minmax(150px, 1.5fr) minmax(80px, 1fr) minmax(45px, 0.5fr) minmax(45px, 0.5fr) minmax(30px, 0.5fr)'
const EVENTS_MIN_WIDTH = '480px'

interface EventsTabProps {
  store: EventsStore
  onExport: () => void
  onClear: () => void
}

export const EventsTab: Component<EventsTabProps> = (props) => {
  const filtered = () => props.store.filteredItems()
  const selected = () => props.store.selectedEntry()

  let containerRef: HTMLDivElement | undefined
  const containerWidth = useContainerWidth(() => containerRef)

  let startWidth = 0

  return (
    <>
      <div class="events-toolbar">
        <ChipSelect
          class="persistence-selector"
          label="Persistence"
          values={['Permanent', 'Stateful', 'Anticipated']}
          selected={props.store.persistenceFilter()}
          onToggle={(v) =>
            props.store.togglePersistenceFilter(v as 'Permanent' | 'Stateful' | 'Anticipated')
          }
          onSelectAll={() => props.store.selectAllPersistence()}
          onClear={() => props.store.clearPersistence()}
          colorVar="persistence"
        />
        <MultiSelect
          class="type-selector"
          label="Type"
          values={props.store.seenEventTypes()}
          selected={props.store.typeFilter()}
          onToggle={(v) => props.store.toggleTypeFilter(v)}
          onSelectAll={() => props.store.selectAllTypes()}
          onClear={() => props.store.clearTypeFilter()}
        />
        <div class="toolbar-filter">
          <input
            class="toolbar-input"
            type="text"
            placeholder="Filter stream..."
            value={props.store.streamFilter()}
            onInput={(e) => props.store.setStreamFilter(e.currentTarget.value)}
          />
        </div>
        <button class="toolbar-btn" onClick={() => props.onExport()}>
          Export
        </button>
        <button class="toolbar-btn" onClick={() => props.onClear()}>
          Clear
        </button>
        <span class="count">{filtered().length} events</span>
      </div>

      <div class="events-layout" ref={containerRef}>
        <div class="events-list">
          <div class="events-scroll-wrap">
            <div style={{ 'min-width': EVENTS_MIN_WIDTH }}>
              <div
                class="events-header"
                style={{ display: 'grid', 'grid-template-columns': EVENTS_COLUMNS }}
              >
                <span>Time</span>
                <span>Type</span>
                <span>Stream</span>
                <span style={{ 'text-align': 'right' }}>Rev</span>
                <span style={{ 'text-align': 'center' }}>Pers</span>
                <span style={{ 'text-align': 'center' }}>{'\u2713'}</span>
              </div>
              <Show
                when={filtered().length > 0}
                fallback={<div class="empty-state">No events</div>}
              >
                <VirtualScroller
                  items={filtered}
                  filterVersion={props.store.filterVersion}
                  renderRow={(item) => (
                    <EventRow
                      item={item}
                      columns={EVENTS_COLUMNS}
                      selected={
                        item.kind === 'event' && props.store.selectedId() === item.entry.entryId
                      }
                      onSelect={() => {
                        if (item.kind === 'event') {
                          props.store.selectEvent(item.entry.entryId)
                        }
                      }}
                      getProcessorResult={props.store.getProcessorResult}
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
                  startWidth = getPanelWidth('events', containerWidth())
                }}
                onDrag={(delta) => {
                  setPanelWidth('events', startWidth + delta, containerWidth())
                }}
              />
              <EventDetail
                entry={entry()}
                processorResult={props.store.getProcessorResult(entry().event.id)}
                onClose={() => props.store.selectEvent(undefined)}
                width={getPanelWidth('events', containerWidth())}
              />
            </>
          )}
        </Show>
      </div>
    </>
  )
}
