import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { getPanelWidth, setPanelWidth } from '../../panelWidths.js'
import type { CacheStore } from '../../stores/cache.js'
import { useContainerWidth } from '../../useContainerWidth.js'
import { DragHandle } from '../DragHandle.js'
import { MultiSelect } from '../MultiSelect.js'
import { VirtualScroller } from '../VirtualScroller.js'
import { CacheDetail } from './CacheDetail.js'
import { CacheRow } from './CacheRow.js'

const CACHE_COLUMNS =
  'minmax(70px, 1fr) minmax(100px, 1.5fr) minmax(50px, 0.5fr) minmax(60px, 0.5fr) minmax(70px, 0.5fr)'
const CACHE_MIN_WIDTH = '410px'

interface CacheTabProps {
  store: CacheStore
  onExport: () => void
  onClear: () => void
}

export const CacheTab: Component<CacheTabProps> = (props) => {
  const filtered = () => props.store.filteredEntries()
  const selected = () => props.store.selectedEntry()

  let containerRef: HTMLDivElement | undefined
  const containerWidth = useContainerWidth(() => containerRef)

  let startWidth = 0

  return (
    <>
      <div class="cache-toolbar">
        <MultiSelect
          class="collection-selector"
          label="Collection"
          values={props.store.seenCollections()}
          selected={props.store.collectionFilter()}
          onToggle={(v) => props.store.toggleCollectionFilter(v)}
          onSelectAll={() => props.store.selectAllCollections()}
          onClear={() => props.store.clearCollectionFilter()}
        />
        <MultiSelect
          class="status-selector"
          label="Status"
          values={['active', 'evicted']}
          selected={props.store.statusFilter()}
          onToggle={(v) => props.store.toggleStatusFilter(v as 'active' | 'evicted')}
          onSelectAll={() => props.store.selectAllStatuses()}
          onClear={() => props.store.clearStatusFilter()}
        />
        <button class="toolbar-btn" onClick={() => props.onExport()}>
          Export
        </button>
        <button class="toolbar-btn" onClick={() => props.onClear()}>
          Clear
        </button>
        <span class="count">{filtered().length} keys</span>
      </div>

      <div class="cache-layout" ref={containerRef}>
        <div class="cache-list">
          <div class="cache-scroll-wrap">
            <div style={{ 'min-width': CACHE_MIN_WIDTH }}>
              <div
                class="cache-header"
                style={{ display: 'grid', 'grid-template-columns': CACHE_COLUMNS }}
              >
                <span>Key</span>
                <span>Collection</span>
                <span>Policy</span>
                <span>Status</span>
                <span>Time</span>
              </div>
              <Show
                when={filtered().length > 0}
                fallback={<div class="empty-state">No cache keys</div>}
              >
                <VirtualScroller
                  items={filtered}
                  filterVersion={props.store.filterVersion}
                  renderRow={(entry) => (
                    <CacheRow
                      entry={entry}
                      columns={CACHE_COLUMNS}
                      selected={props.store.selectedId() === entry.key}
                      onSelect={() => props.store.selectEntry(entry.key)}
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
                  startWidth = getPanelWidth('cache', containerWidth())
                }}
                onDrag={(delta) => {
                  setPanelWidth('cache', startWidth + delta, containerWidth())
                }}
              />
              <CacheDetail
                entry={entry()}
                onClose={() => props.store.selectEntry(undefined)}
                width={getPanelWidth('cache', containerWidth())}
              />
            </>
          )}
        </Show>
      </div>
    </>
  )
}
