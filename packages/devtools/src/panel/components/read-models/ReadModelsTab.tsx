import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { getPanelWidth, setPanelWidth } from '../../panelWidths.js'
import type { ReadModelsStore } from '../../stores/readModels.js'
import { useArrowSelection } from '../../useArrowSelection.js'
import { useContainerWidth } from '../../useContainerWidth.js'
import { DragHandle } from '../DragHandle.js'
import { FilterInput } from '../FilterInput.js'
import { MultiSelect } from '../MultiSelect.js'
import { VirtualScroller, type VirtualScrollerControls } from '../VirtualScroller.js'
import { ReadModelDetail } from './ReadModelDetail.js'
import { ReadModelRow } from './ReadModelRow.js'

const READMODELS_COLUMNS =
  'minmax(100px, 1.5fr) minmax(40px, 0.3fr) minmax(50px, 0.5fr) minmax(50px, 0.5fr) minmax(70px, 0.5fr)'
const READMODELS_MIN_WIDTH = '370px'

interface ReadModelsTabProps {
  store: ReadModelsStore
  onExport: () => void
  onClear: () => void
}

export const ReadModelsTab: Component<ReadModelsTabProps> = (props) => {
  const filtered = () => props.store.filteredEntries()
  const selected = () => props.store.selectedEntry()

  let containerRef: HTMLDivElement | undefined
  const containerWidth = useContainerWidth(() => containerRef)
  let scroller: VirtualScrollerControls | undefined

  let startWidth = 0

  useArrowSelection({
    items: () => props.store.filteredEntries(),
    selectedId: () => props.store.selectedCollection(),
    getId: (entry) => entry.collection,
    select: (id, index) => {
      props.store.selectCollection(id)
      scroller?.ensureVisible(index)
    },
  })

  return (
    <>
      <div class="rm-toolbar">
        <MultiSelect
          class="collection-selector"
          label="Collection"
          values={props.store.seenCollections()}
          selected={props.store.collectionFilter()}
          onToggle={(v) => props.store.toggleCollectionFilter(v)}
          onSelectAll={() => props.store.selectAllCollections()}
          onClear={() => props.store.clearCollectionFilter()}
        />
        <FilterInput
          placeholder="Filter…"
          value={props.store.textFilter()}
          onInput={(v) => props.store.setTextFilter(v)}
        />
        <span class="toolbar-tail">
          <button class="toolbar-btn" onClick={() => props.onExport()}>
            Export
          </button>
          <button class="toolbar-btn" onClick={() => props.onClear()}>
            Clear
          </button>
          <span class="count">{filtered().length} collections</span>
        </span>
      </div>

      <div class="rm-layout" ref={containerRef}>
        <div class="rm-list">
          <div class="rm-scroll-wrap">
            <div style={{ 'min-width': READMODELS_MIN_WIDTH }}>
              <div
                class="rm-header"
                style={{ display: 'grid', 'grid-template-columns': READMODELS_COLUMNS }}
              >
                <span>Collection</span>
                <span style={{ 'text-align': 'right' }}>Keys</span>
                <span style={{ 'text-align': 'right' }}>Entities</span>
                <span style={{ 'text-align': 'right' }}>Updates</span>
                <span>Last Update</span>
              </div>
              <Show
                when={filtered().length > 0}
                fallback={<div class="empty-state">No read models</div>}
              >
                <VirtualScroller
                  items={filtered}
                  filterVersion={props.store.filterVersion}
                  ref={(c) => {
                    scroller = c
                  }}
                  renderRow={(entry) => (
                    <ReadModelRow
                      entry={entry}
                      columns={READMODELS_COLUMNS}
                      selected={props.store.selectedCollection() === entry.collection}
                      onSelect={() => props.store.selectCollection(entry.collection)}
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
                  startWidth = getPanelWidth('readModels', containerWidth())
                }}
                onDrag={(delta) => {
                  setPanelWidth('readModels', startWidth + delta, containerWidth())
                }}
              />
              <ReadModelDetail
                entry={entry()}
                onClose={() => props.store.selectCollection(undefined)}
                width={getPanelWidth('readModels', containerWidth())}
              />
            </>
          )}
        </Show>
      </div>
    </>
  )
}
