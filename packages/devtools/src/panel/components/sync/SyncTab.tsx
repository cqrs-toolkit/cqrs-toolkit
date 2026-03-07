import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { getPanelWidth, setPanelWidth } from '../../panelWidths.js'
import type { SyncStore } from '../../stores/sync.js'
import { useContainerWidth } from '../../useContainerWidth.js'
import { DragHandle } from '../DragHandle.js'
import { VirtualScroller } from '../VirtualScroller.js'
import { SyncDetail } from './SyncDetail.js'
import { SyncRow } from './SyncRow.js'

const SYNC_COLUMNS =
  'minmax(70px, 0.5fr) minmax(100px, 1fr) minmax(80px, 0.8fr) minmax(120px, 1.5fr)'
const SYNC_MIN_WIDTH = '420px'

interface SyncTabProps {
  store: SyncStore
  onClear: () => void
}

export const SyncTab: Component<SyncTabProps> = (props) => {
  const filtered = () => props.store.filteredItems()
  const selected = () => props.store.selectedEntry()

  let containerRef: HTMLDivElement | undefined
  const containerWidth = useContainerWidth(() => containerRef)

  let startWidth = 0

  return (
    <>
      <div class="sync-toolbar">
        <Show when={props.store.online() !== undefined}>
          <span
            class={`sync-online-dot ${props.store.online() ? 'sync-online' : 'sync-offline'}`}
          />
        </Show>
        <Show when={props.store.wsState()}>
          {(ws) => <span class={`sync-ws-badge sync-ws-${ws()}`}>{ws()}</span>}
        </Show>
        <div class="toolbar-filter">
          <input
            class="toolbar-input"
            type="text"
            placeholder="Filter type..."
            value={props.store.typeFilter()}
            onInput={(e) => props.store.setTypeFilter(e.currentTarget.value)}
          />
        </div>
        <button class="toolbar-btn" onClick={() => props.onClear()}>
          Clear
        </button>
        <span class="count">{filtered().length} entries</span>
      </div>

      <div class="sync-layout" ref={containerRef}>
        <div class="sync-list">
          <div class="sync-scroll-wrap">
            <div style={{ 'min-width': SYNC_MIN_WIDTH }}>
              <div
                class="sync-header"
                style={{ display: 'grid', 'grid-template-columns': SYNC_COLUMNS }}
              >
                <span>Time</span>
                <span>Type</span>
                <span>Scope</span>
                <span>Details</span>
              </div>
              <Show
                when={filtered().length > 0}
                fallback={<div class="empty-state">No sync activity</div>}
              >
                <VirtualScroller
                  items={filtered}
                  filterVersion={props.store.filterVersion}
                  renderRow={(item) => (
                    <SyncRow
                      item={item}
                      columns={SYNC_COLUMNS}
                      selected={
                        item.kind === 'event' && props.store.selectedId() === item.entry.entryId
                      }
                      onSelect={() => {
                        if (item.kind === 'event') {
                          props.store.selectEntry(item.entry.entryId)
                        }
                      }}
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
                  startWidth = getPanelWidth('sync', containerWidth())
                }}
                onDrag={(delta) => {
                  setPanelWidth('sync', startWidth + delta, containerWidth())
                }}
              />
              <SyncDetail
                entry={entry()}
                onClose={() => props.store.selectEntry(undefined)}
                width={getPanelWidth('sync', containerWidth())}
              />
            </>
          )}
        </Show>
      </div>
    </>
  )
}
