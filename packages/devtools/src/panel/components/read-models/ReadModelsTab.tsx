import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { getPanelWidth, setPanelWidth } from '../../panelWidths.js'
import type { ReadModelsStore } from '../../stores/readModels.js'
import { useContainerWidth } from '../../useContainerWidth.js'
import { DragHandle } from '../DragHandle.js'
import { VirtualScroller } from '../VirtualScroller.js'
import { ReadModelDetail } from './ReadModelDetail.js'
import { ReadModelRow } from './ReadModelRow.js'

const READMODELS_COLUMNS =
  'minmax(100px, 1.5fr) minmax(40px, 0.3fr) minmax(50px, 0.5fr) minmax(50px, 0.5fr) minmax(70px, 0.5fr)'
const READMODELS_MIN_WIDTH = '370px'

interface ReadModelsTabProps {
  store: ReadModelsStore
  onClear: () => void
}

export const ReadModelsTab: Component<ReadModelsTabProps> = (props) => {
  const filtered = () => props.store.filteredEntries()
  const selected = () => props.store.selectedEntry()

  let containerRef: HTMLDivElement | undefined
  const containerWidth = useContainerWidth(() => containerRef)

  let startWidth = 0

  return (
    <>
      <div class="rm-toolbar">
        <div class="toolbar-filter">
          <input
            class="toolbar-input"
            type="text"
            placeholder="Filter collection..."
            value={props.store.collectionFilter()}
            onInput={(e) => props.store.setCollectionFilter(e.currentTarget.value)}
          />
        </div>
        <button class="toolbar-btn" onClick={() => props.onClear()}>
          Clear
        </button>
        <span class="count">{filtered().length} collections</span>
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
