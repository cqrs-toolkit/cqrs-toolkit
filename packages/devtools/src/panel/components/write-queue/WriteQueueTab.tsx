import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { getPanelWidth, setPanelWidth } from '../../panelWidths.js'
import type { WriteQueueStore } from '../../stores/writeQueue.js'
import { useArrowSelection } from '../../useArrowSelection.js'
import { useContainerWidth } from '../../useContainerWidth.js'
import { DragHandle } from '../DragHandle.js'
import { FilterInput } from '../FilterInput.js'
import { MultiSelect } from '../MultiSelect.js'
import { VirtualScroller, type VirtualScrollerControls } from '../VirtualScroller.js'
import { WriteQueueDetail } from './WriteQueueDetail.js'
import { WriteQueueRow } from './WriteQueueRow.js'

const WQ_COLUMNS = '70px 35px 140px 80px 55px'
const WQ_MIN_WIDTH = '400px'

interface WriteQueueTabProps {
  store: WriteQueueStore
  onExport: () => void
  onClear: () => void
}

export const WriteQueueTab: Component<WriteQueueTabProps> = (props) => {
  const filtered = () => props.store.filteredEntries()
  const selected = () => props.store.selectedEntry()

  let containerRef: HTMLDivElement | undefined
  const containerWidth = useContainerWidth(() => containerRef)
  let scroller: VirtualScrollerControls | undefined

  let startWidth = 0

  useArrowSelection({
    items: () => props.store.filteredEntries(),
    selectedId: () => props.store.selectedId(),
    getId: (entry) => entry.opId,
    select: (id, index) => {
      props.store.selectEntry(id)
      scroller?.ensureVisible(index)
    },
  })

  return (
    <>
      <div class="wq-toolbar">
        <Show when={props.store.resetInProgress()}>
          <span class="wq-reset-badge">Resetting</span>
        </Show>
        <MultiSelect
          class="type-selector"
          label="Op Type"
          values={props.store.seenTypes()}
          selected={props.store.typeFilter()}
          onToggle={(v) => props.store.toggleTypeFilter(v)}
          onSelectAll={() => props.store.selectAllTypes()}
          onClear={() => props.store.clearTypeFilter()}
        />
        <MultiSelect
          class="status-selector"
          label="Status"
          values={props.store.seenStatuses()}
          selected={props.store.statusFilter()}
          onToggle={(v) => props.store.toggleStatusFilter(v)}
          onSelectAll={() => {}}
          onClear={() => {
            props.store.statusFilter().clear()
          }}
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
          <span class="count">
            {filtered().length} ops
            <Show when={props.store.pendingCount() > 0}>
              {' '}
              ({props.store.pendingCount()} active)
            </Show>
            {' · '}
            {props.store.opsPerSecond() ?? '—'} ops/s
          </span>
        </span>
      </div>

      <div class="wq-layout" ref={containerRef}>
        <div class="wq-list">
          <div class="wq-scroll-wrap">
            <div style={{ 'min-width': WQ_MIN_WIDTH }}>
              <div
                class="wq-header"
                style={{ display: 'grid', 'grid-template-columns': WQ_COLUMNS }}
              >
                <span>Time</span>
                <span>ID</span>
                <span>Type</span>
                <span>Status</span>
                <span>Duration</span>
              </div>
              <Show
                when={filtered().length > 0}
                fallback={<div class="empty-state">No write queue operations</div>}
              >
                <VirtualScroller
                  items={filtered}
                  filterVersion={props.store.filterVersion}
                  ref={(c) => {
                    scroller = c
                  }}
                  renderRow={(entry) => (
                    <WriteQueueRow
                      entry={entry}
                      columns={WQ_COLUMNS}
                      selected={props.store.selectedId() === entry.opId}
                      onSelect={() => props.store.selectEntry(entry.opId)}
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
                  startWidth = getPanelWidth('writeQueue', containerWidth())
                }}
                onDrag={(delta) => {
                  setPanelWidth('writeQueue', startWidth + delta, containerWidth())
                }}
              />
              <WriteQueueDetail
                entry={entry()}
                onClose={() => props.store.selectEntry(undefined)}
                width={getPanelWidth('writeQueue', containerWidth())}
              />
            </>
          )}
        </Show>
      </div>
    </>
  )
}
