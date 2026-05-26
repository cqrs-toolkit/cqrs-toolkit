import { createMemo, createSignal, For, onCleanup, Show, type Component, type JSX } from 'solid-js'
import type { NetCaptureState } from '../../../shared/protocol.js'
import { getPanelWidth, setPanelWidth } from '../../panelWidths.js'
import {
  isNetworkColumnId,
  NETWORK_COLUMN_IDS,
  settings,
  type NetworkColumnId,
} from '../../storage/preferences.js'
import type {
  HttpRow,
  NetworkRow,
  NetworkSessionEntry,
  NetworkStore,
  WsFrameRow,
  WsLifecycleRow,
} from '../../stores/network.js'
import { useArrowSelection } from '../../useArrowSelection.js'
import { useContainerWidth } from '../../useContainerWidth.js'
import { DragHandle } from '../DragHandle.js'
import { FilterInput } from '../FilterInput.js'
import { MultiSelect } from '../MultiSelect.js'
import { toCurl, toFetch, toFetchNode, toHarFragment, toPowerShell } from './codegen.js'
import { ContextMenu, type ContextMenuState, type MenuItem } from './ContextMenu.js'
import { formatMs } from './timing.js'
import { TimingChart } from './TimingChart.js'

interface NetworkTabProps {
  store: NetworkStore
  onStart: () => void
  onStop: () => void
  onExport: () => void
  onClear: () => void
}

interface ColumnDef {
  id: NetworkColumnId
  label: string
  width: string
  align?: 'left' | 'right' | 'center'
  cell: (row: NetworkRow) => JSX.Element
  cellTitle?: (row: NetworkRow) => string | undefined
}

const COLUMN_LABELS: Record<NetworkColumnId, string> = {
  name: 'Name',
  path: 'Path',
  url: 'URL',
  method: 'Method',
  status: 'Status',
  scheme: 'Scheme',
  domain: 'Domain',
  remoteAddress: 'Remote address',
  type: 'Type',
  initiator: 'Initiator',
  source: 'Source',
  cookies: 'Cookies',
  setCookies: 'Set Cookies',
  size: 'Size',
  time: 'Time',
  waterfall: 'Waterfall',
}

export const NetworkTab: Component<NetworkTabProps> = (props) => {
  const rows = () => props.store.filteredRows()
  const allRows = () => props.store.rows()
  const sessions = () => props.store.sessions()
  const selected = () => props.store.selectedRow()
  const state = () => props.store.captureState()

  let containerRef: HTMLDivElement | undefined
  const containerWidth = useContainerWidth(() => containerRef)
  let startWidth = 0

  const [menuState, setMenuState] = createSignal<ContextMenuState | undefined>()

  useArrowSelection<NetworkRow>({
    items: () => props.store.filteredRows(),
    selectedId: () => props.store.selectedId(),
    getId: (row) => row.id,
    select: (id) => {
      props.store.selectRow(id)
      // Scroll the now-selected row into view if it isn't already.
      queueMicrotask(() => {
        const el = document.querySelector(`[data-network-row-id="${CSS.escape(id)}"]`)
        if (el instanceof HTMLElement) el.scrollIntoView({ block: 'nearest' })
      })
    },
  })

  function openHttpContextMenu(e: MouseEvent, row: HttpRow): void {
    e.preventDefault()
    setMenuState({
      x: e.clientX,
      y: e.clientY,
      items: buildHttpMenu(row),
    })
  }

  const timeWindow = createMemo(() => {
    const list = allRows()
    if (list.length === 0) return undefined
    let firstStart = Infinity
    let maxEnd = -Infinity
    for (const r of list) {
      const rowStart = r.kind === 'http' ? (r.startedAt ?? r.timestamp) : r.timestamp
      const rowEnd =
        r.kind === 'http' ? (r.finishedAt ?? r.failedAt ?? r.respondedAt ?? rowStart) : rowStart
      if (rowStart < firstStart) firstStart = rowStart
      if (rowEnd > maxEnd) maxEnd = rowEnd
    }
    if (!Number.isFinite(firstStart)) return undefined
    const start = firstStart
    const naturalEnd = Number.isFinite(maxEnd) ? maxEnd : start
    // Minimum 110 ms span anchored at the first detected request, growing as
    // later requests / WS frames push the upper bound.
    const end = Math.max(naturalEnd, start + 110)
    return { start, end, span: end - start }
  })

  const [selectedColumns, setSelectedColumns] = createSignal<Set<NetworkColumnId>>(
    new Set(settings.networkColumns),
  )
  // Apply persisted HTTP/WS visibility to the store immediately.
  props.store.setShowHttp(settings.networkShowHttp)
  props.store.setShowWs(settings.networkShowWs)

  function toggleHttp(): void {
    const next = !props.store.showHttp()
    props.store.setShowHttp(next)
    void settings.update({ networkShowHttp: next })
  }
  function toggleWs(): void {
    const next = !props.store.showWs()
    props.store.setShowWs(next)
    void settings.update({ networkShowWs: next })
  }

  function toggleColumn(id: NetworkColumnId): void {
    const next = new Set(selectedColumns())
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedColumns(next)
    void settings.update({ networkColumns: [...next] })
  }
  function selectAllColumns(): void {
    const all = new Set<NetworkColumnId>(NETWORK_COLUMN_IDS)
    setSelectedColumns(all)
    void settings.update({ networkColumns: [...all] })
  }
  function clearAllColumns(): void {
    setSelectedColumns(new Set<NetworkColumnId>())
    void settings.update({ networkColumns: [] })
  }

  const columnsById: Record<NetworkColumnId, ColumnDef> = {
    name: {
      id: 'name',
      label: COLUMN_LABELS.name,
      width: 'minmax(180px, 2.5fr)',
      cell: (row) => renderName(row),
      cellTitle: (row) => httpOrLifecycleUrl(row),
    },
    path: {
      id: 'path',
      label: COLUMN_LABELS.path,
      width: 'minmax(120px, 1.5fr)',
      cell: (row) => urlPath(httpOrLifecycleUrl(row) ?? ''),
      cellTitle: (row) => httpOrLifecycleUrl(row),
    },
    url: {
      id: 'url',
      label: COLUMN_LABELS.url,
      width: 'minmax(180px, 2fr)',
      cell: (row) => httpOrLifecycleUrl(row) ?? '',
      cellTitle: (row) => httpOrLifecycleUrl(row),
    },
    method: {
      id: 'method',
      label: COLUMN_LABELS.method,
      width: '70px',
      cell: (row) => renderMethod(row),
    },
    status: {
      id: 'status',
      label: COLUMN_LABELS.status,
      width: '70px',
      align: 'right',
      cell: (row) => renderStatus(row),
    },
    scheme: {
      id: 'scheme',
      label: COLUMN_LABELS.scheme,
      width: '60px',
      cell: (row) => urlScheme(httpOrLifecycleUrl(row) ?? ''),
    },
    domain: {
      id: 'domain',
      label: COLUMN_LABELS.domain,
      width: 'minmax(80px, 1fr)',
      cell: (row) => urlDomain(httpOrLifecycleUrl(row) ?? ''),
      cellTitle: (row) => httpOrLifecycleUrl(row),
    },
    remoteAddress: {
      id: 'remoteAddress',
      label: COLUMN_LABELS.remoteAddress,
      width: '120px',
      cell: (row) => renderRemoteAddress(row),
    },
    type: {
      id: 'type',
      label: COLUMN_LABELS.type,
      width: '90px',
      cell: (row) => renderType(row),
    },
    initiator: {
      id: 'initiator',
      label: COLUMN_LABELS.initiator,
      width: 'minmax(120px, 1fr)',
      cell: (row) => renderInitiator(row),
      cellTitle: (row) => renderInitiator(row),
    },
    source: {
      id: 'source',
      label: COLUMN_LABELS.source,
      width: '70px',
      cell: (row) => row.source,
      cellTitle: (row) => `${row.session.targetType} · ${row.session.targetUrl}`,
    },
    cookies: {
      id: 'cookies',
      label: COLUMN_LABELS.cookies,
      width: '70px',
      align: 'right',
      cell: (row) => renderCookieCount(row, 'request'),
    },
    setCookies: {
      id: 'setCookies',
      label: COLUMN_LABELS.setCookies,
      width: '80px',
      align: 'right',
      cell: (row) => renderCookieCount(row, 'response'),
    },
    size: {
      id: 'size',
      label: COLUMN_LABELS.size,
      width: '80px',
      align: 'right',
      cell: (row) => renderSize(row),
    },
    time: {
      id: 'time',
      label: COLUMN_LABELS.time,
      width: '80px',
      align: 'right',
      cell: (row) => renderTime(row),
    },
    waterfall: {
      id: 'waterfall',
      label: COLUMN_LABELS.waterfall,
      width: 'minmax(120px, 2fr)',
      cell: (row) => <Waterfall row={row} window={timeWindow()} />,
    },
  }

  const visibleColumns = createMemo((): ColumnDef[] => {
    const sel = selectedColumns()
    return NETWORK_COLUMN_IDS.filter((id) => sel.has(id)).map((id) => columnsById[id])
  })
  const gridTemplate = createMemo(() =>
    visibleColumns()
      .map((c) => c.width)
      .join(' '),
  )

  return (
    <>
      <div class="events-toolbar">
        <CaptureToggle
          state={state()}
          onStart={() => props.onStart()}
          onStop={() => props.onStop()}
        />
        <KindToggle label="HTTP" on={props.store.showHttp()} onToggle={toggleHttp} />
        <KindToggle label="WS" on={props.store.showWs()} onToggle={toggleWs} />
        <FilterInput
          placeholder="Filter all"
          value={props.store.globalFilter()}
          onInput={props.store.setGlobalFilter}
        />
        <Show when={props.store.showHttp()}>
          <FilterInput
            placeholder="Filter HTTP"
            value={props.store.httpFilter()}
            onInput={props.store.setHttpFilter}
          />
        </Show>
        <Show when={props.store.showWs()}>
          <FilterInput
            placeholder="Filter WS"
            value={props.store.wsFilter()}
            onInput={props.store.setWsFilter}
          />
        </Show>
        <MultiSelect
          label="Columns"
          values={[...NETWORK_COLUMN_IDS]}
          selected={new Set<string>(selectedColumns())}
          onToggle={(id) => {
            if (isNetworkColumnId(id)) toggleColumn(id)
          }}
          onSelectAll={selectAllColumns}
          onClear={clearAllColumns}
          formatValue={(id) => (isNetworkColumnId(id) ? COLUMN_LABELS[id] : id)}
        />
        <CaptureIndicator state={state()} sessions={sessions()} />
        <span class="toolbar-tail">
          <button class="toolbar-btn" onClick={() => props.onExport()}>
            Export
          </button>
          <button class="toolbar-btn" onClick={() => props.onClear()}>
            Clear
          </button>
          <span class="count">
            {rows().length}/{allRows().length}
          </span>
        </span>
      </div>

      <CaptureBanner state={state()} />

      <Overview
        rows={allRows()}
        selectedRowId={props.store.selectedId()}
        window={timeWindow()}
        selectionStart={props.store.selectionStart()}
        selectionEnd={props.store.selectionEnd()}
        onSetSelection={(s, e) => props.store.setSelectionRange(s, e)}
        onClearSelection={() => props.store.clearSelectionRange()}
      />

      <div class="events-layout" ref={containerRef}>
        <div class="events-list">
          <div style={{ flex: '1 1 auto', overflow: 'auto', 'min-width': 0 }}>
            <HeaderRow columns={visibleColumns()} gridTemplate={gridTemplate()} />
            <Show
              when={rows().length > 0}
              fallback={
                <div
                  style={{
                    padding: '24px 16px',
                    'text-align': 'center',
                    color: 'var(--text-muted)',
                    'font-size': '12px',
                  }}
                >
                  <Show
                    when={state().status === 'capturing'}
                    fallback="Click Start to capture network traffic."
                  >
                    Waiting for traffic…
                  </Show>
                </div>
              }
            >
              <For each={rows()}>
                {(row) => (
                  <NetworkRowView
                    row={row}
                    selected={props.store.selectedId() === row.id}
                    onSelect={() => props.store.selectRow(row.id)}
                    onContextMenu={(e) => {
                      if (row.kind === 'http') openHttpContextMenu(e, row)
                    }}
                    columns={visibleColumns()}
                    gridTemplate={gridTemplate()}
                  />
                )}
              </For>
            </Show>
          </div>
        </div>

        <ContextMenu state={menuState()} onClose={() => setMenuState(undefined)} />

        <Show when={selected()}>
          {(row) => (
            <>
              <DragHandle
                onDragStart={() => {
                  startWidth = getPanelWidth('network', containerWidth())
                }}
                onDrag={(delta) => {
                  setPanelWidth('network', startWidth + delta, containerWidth())
                }}
              />
              <div
                style={{
                  width: `${getPanelWidth('network', containerWidth())}px`,
                  'flex-shrink': 0,
                  'border-left': '1px solid var(--border)',
                  overflow: 'auto',
                  padding: '8px 10px',
                  'font-size': '11px',
                }}
              >
                <button
                  class="toolbar-btn"
                  onClick={() => props.store.selectRow(undefined)}
                  style={{ float: 'right' }}
                >
                  Close
                </button>
                <DetailPane row={row()} />
              </div>
            </>
          )}
        </Show>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Toolbar bits
// ---------------------------------------------------------------------------

/**
 * Pill toggle for showing/hiding a kind of row (HTTP or WS). Visually
 * deemphasised when off; matching kind's filter input is hidden by the
 * parent so the toolbar stays tidy.
 */
const KindToggle: Component<{ label: string; on: boolean; onToggle: () => void }> = (props) => (
  <button
    onClick={() => props.onToggle()}
    title={props.on ? `Hide ${props.label} rows` : `Show ${props.label} rows`}
    style={{
      padding: '2px 8px',
      border: '1px solid var(--border)',
      'border-radius': '10px',
      background: props.on ? 'var(--chip-active-bg)' : 'transparent',
      color: props.on ? 'var(--chip-active-text)' : 'var(--text-muted)',
      'font-size': '10px',
      'font-weight': '600',
      cursor: 'pointer',
      'line-height': 1,
      opacity: props.on ? 1 : 0.7,
    }}
  >
    {props.label}
  </button>
)

/**
 * Single-button capture toggle. Idle / detached / error → green play; while
 * attaching or actively capturing → red stop. Sized larger than neighbouring
 * toolbar buttons since the panel is non-functional until it's clicked.
 */
const CaptureToggle: Component<{
  state: NetCaptureState
  onStart: () => void
  onStop: () => void
}> = (props) => {
  const isActive = () => props.state.status === 'capturing' || props.state.status === 'attaching'

  return (
    <button
      onClick={() => (isActive() ? props.onStop() : props.onStart())}
      title={isActive() ? 'Stop capture' : 'Start capture'}
      style={{
        width: '26px',
        height: '26px',
        padding: 0,
        margin: '0 4px 0 0',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        display: 'inline-flex',
        'align-items': 'center',
        'justify-content': 'center',
      }}
    >
      {isActive() ? <StopIcon /> : <PlayIcon />}
    </button>
  )
}

const PlayIcon: Component = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
    <circle
      cx="11"
      cy="11"
      r="10"
      fill="none"
      stroke="var(--status-succeeded)"
      stroke-width="1.5"
    />
    <path d="M 8 6.5 L 8 15.5 L 16 11 Z" fill="var(--status-succeeded)" />
  </svg>
)

const StopIcon: Component = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
    <circle cx="11" cy="11" r="10" fill="none" stroke="var(--status-failed)" stroke-width="1.5" />
    <rect x="6.5" y="6.5" width="9" height="9" rx="1" fill="var(--status-failed)" />
  </svg>
)

/**
 * Compact in-toolbar capture indicator. A small coloured dot summarises the
 * state; the tooltip lists attached targets so the user can drill in without
 * the panel needing a dedicated row for them. Errors and conflicts also
 * surface as a full-width banner below the toolbar (see CaptureBanner).
 */
const CaptureIndicator: Component<{
  state: NetCaptureState
  sessions: NetworkSessionEntry[]
}> = (props) => {
  const color = () => {
    switch (props.state.status) {
      case 'capturing':
        return props.sessions.some((s) => !s.detachedAt)
          ? 'var(--status-succeeded)'
          : 'var(--banner-warning-text)'
      case 'attaching':
        return 'var(--status-sending)'
      case 'error':
        return 'var(--status-failed)'
      case 'conflict':
        return 'var(--banner-warning-text)'
      case 'detached':
        return 'var(--text-muted)'
      default:
        return 'var(--text-muted)'
    }
  }
  const summary = () => {
    switch (props.state.status) {
      case 'idle':
        return 'Idle. Click play to start.'
      case 'attaching':
        return 'Attaching to debugger…'
      case 'capturing': {
        const live = props.sessions.filter((s) => !s.detachedAt)
        if (live.length === 0) return 'Capturing — waiting for a SharedWorker to attach.'
        return `Capturing ${live.length} target${live.length === 1 ? '' : 's'}:\n${live
          .map((s) => `· ${s.session.targetType} ${s.session.targetUrl}`)
          .join('\n')}`
      }
      case 'error':
        return `Error: ${props.state.reason}`
      case 'conflict':
        return 'Another DevTools instance owns the SharedWorker debugger. See banner below.'
      case 'detached':
        return `Detached: ${props.state.reason}`
    }
  }
  return (
    <span
      title={summary()}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        gap: '4px',
        'margin-left': '8px',
        'font-size': '11px',
        color: 'var(--text-secondary)',
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          'border-radius': '50%',
          background: color(),
          'flex-shrink': 0,
        }}
      />
      <Show when={props.state.status === 'capturing'}>
        {(() => {
          const live = props.sessions.filter((s) => !s.detachedAt)
          return live.length === 0 ? (
            <>no targets</>
          ) : (
            <>
              {live.length} target{live.length === 1 ? '' : 's'}
            </>
          )
        })()}
      </Show>
    </span>
  )
}

/**
 * Full-width banner for capture states that need real estate to explain.
 * Conflict + error → warning style. Idle / capturing / attaching → no banner
 * (the toolbar indicator carries the signal).
 */
const CaptureBanner: Component<{ state: NetCaptureState }> = (props) => (
  <Show when={props.state.status === 'conflict' || props.state.status === 'error'}>
    <div
      style={{
        padding: '8px 10px',
        'border-bottom': '1px solid var(--banner-warning-border)',
        background: 'var(--banner-warning-bg)',
        color: 'var(--banner-warning-text)',
        'font-size': '12px',
        'line-height': '1.4',
      }}
    >
      <Show when={props.state.status === 'conflict'}>
        <strong>Network capture unavailable in this DevTools window.</strong>
        <div style={{ 'margin-top': '4px' }}>
          Another DevTools instance is already attached to the SharedWorker debugger (only one is
          supported at a time). The other panels in this tab (Commands, Events, Cache, Read Models,
          Sync, Write Queue, EventBus, Storage) continue to work normally — they read library state
          through a separate channel.
        </div>
        <div style={{ 'margin-top': '4px' }}>
          Stop network capture in the other DevTools window (or close it), then click the green play
          button here to retry.
        </div>
      </Show>
      <Show when={props.state.status === 'error'}>
        <strong>Network capture error.</strong>
        <div style={{ 'margin-top': '4px', 'font-family': 'monospace', 'font-size': '11px' }}>
          {props.state.status === 'error' ? props.state.reason : ''}
        </div>
      </Show>
    </div>
  </Show>
)

// ---------------------------------------------------------------------------
// Overview ruler
// ---------------------------------------------------------------------------

interface TimeWindow {
  start: number
  end: number
  span: number
}

const OVERVIEW_HEIGHT = 80
const OVERVIEW_LABEL_HEIGHT = 18
const LANE_TOP_PADDING = 2
const LANE_BOTTOM_PADDING = 2
const LANE_ITEM_HEIGHT = 6
// 2px gap between lanes — when a row is selected its 1px outline shrinks
// the visible gap to 1px without intersecting the next lane.
const LANE_GAP = 2
const LANE_STRIDE = LANE_ITEM_HEIGHT + LANE_GAP
// Total lanes the strip can show without clipping; the bottommost lane is
// reserved as the overflow aggregator so further-concurrent rows still
// register their density instead of escaping the container.
const MAX_LANES = Math.max(
  2,
  Math.floor(
    (OVERVIEW_HEIGHT - OVERVIEW_LABEL_HEIGHT - LANE_TOP_PADDING - LANE_BOTTOM_PADDING) /
      LANE_STRIDE,
  ),
)
const OVERFLOW_LANE = MAX_LANES - 1
const NORMAL_LANE_CAP = MAX_LANES - 1

const Overview: Component<{
  rows: NetworkRow[]
  selectedRowId: string | undefined
  window: TimeWindow | undefined
  selectionStart: number | undefined
  selectionEnd: number | undefined
  onSetSelection: (start: number, end: number) => void
  onClearSelection: () => void
}> = (props) => {
  let stripRef: HTMLDivElement | undefined
  let dragCleanup: (() => void) | undefined

  function timeFromClientX(clientX: number): number | undefined {
    const w = props.window
    if (!w || !stripRef) return undefined
    const rect = stripRef.getBoundingClientRect()
    const ratio = (clientX - rect.left) / Math.max(1, rect.width)
    return w.start + clamp01(ratio) * w.span
  }

  /**
   * Begin a drag that maps each mousemove to a time via the strip's geometry,
   * forwarding the resolved time to the supplied updater. Releases on mouseup.
   */
  function beginDrag(onTime: (t: number) => void): void {
    function onMove(ev: MouseEvent): void {
      const t = timeFromClientX(ev.clientX)
      if (t === undefined) return
      onTime(t)
    }
    function onUp(): void {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      dragCleanup = undefined
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    dragCleanup = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }

  // Mousedown on empty strip → new selection from anchor.
  function handleStripMouseDown(e: MouseEvent): void {
    if (!props.window) return
    e.preventDefault()
    const anchor = timeFromClientX(e.clientX)
    if (anchor === undefined) return
    const anchorMs: number = anchor
    props.onSetSelection(anchorMs, anchorMs)
    beginDrag((t) => props.onSetSelection(anchorMs, t))
  }

  // Mousedown on left/right paddle → drag that bound only.
  function handlePaddleMouseDown(side: 'left' | 'right', e: MouseEvent): void {
    if (!props.window) return
    e.preventDefault()
    e.stopPropagation()
    const fixed = side === 'left' ? props.selectionEnd : props.selectionStart
    if (fixed === undefined) return
    const fixedMs: number = fixed
    beginDrag((t) =>
      side === 'left' ? props.onSetSelection(t, fixedMs) : props.onSetSelection(fixedMs, t),
    )
  }

  // Mousedown on the selection band → translate the whole window.
  function handleBandMouseDown(e: MouseEvent): void {
    if (!props.window) return
    const start = props.selectionStart
    const end = props.selectionEnd
    if (start === undefined || end === undefined) return
    e.preventDefault()
    e.stopPropagation()
    const width = end - start
    const anchorTime = timeFromClientX(e.clientX)
    if (anchorTime === undefined) return
    const offset = anchorTime - start
    beginDrag((t) => {
      const newStart = t - offset
      props.onSetSelection(newStart, newStart + width)
    })
  }

  function handleDoubleClick(): void {
    props.onClearSelection()
  }

  onCleanup(() => dragCleanup?.())

  const selectionPair = createMemo((): { start: number; end: number } | undefined => {
    const s = props.selectionStart
    const e = props.selectionEnd
    if (s === undefined || e === undefined) return undefined
    return { start: s, end: e }
  })

  /**
   * Greedy lane assignment: rows sorted by start time descend through lanes
   * (oldest start = topmost) and slot into the first lane whose last-end is
   * already at or before this row's start. Overlapping rows therefore stack
   * downward without colliding. Once the normal lane budget is exhausted,
   * further rows collapse into the bottom overflow lane so they remain
   * visible as a density indicator without escaping the strip.
   */
  const placedRows = createMemo((): { row: NetworkRow; lane: number; overflow: boolean }[] => {
    const sorted = [...props.rows].sort((a, b) => rowStart(a) - rowStart(b))
    const laneEnds: number[] = []
    const out: { row: NetworkRow; lane: number; overflow: boolean }[] = []
    for (const row of sorted) {
      const start = rowStart(row)
      const end = rowEnd(row)
      let lane = laneEnds.findIndex((e) => e <= start)
      if (lane === -1) {
        if (laneEnds.length < NORMAL_LANE_CAP) {
          lane = laneEnds.length
          laneEnds.push(end)
        } else {
          out.push({ row, lane: OVERFLOW_LANE, overflow: true })
          continue
        }
      } else {
        laneEnds[lane] = end
      }
      out.push({ row, lane, overflow: false })
    }
    return out
  })

  const ticks = createMemo(() => {
    const w = props.window
    if (!w) return [] as { t: number; left: number; label: string }[]
    const interval = chooseTickInterval(w.span)
    const out: { t: number; left: number; label: string }[] = []
    // Anchor ticks at multiples of interval relative to start.
    const first = Math.ceil(w.start / interval) * interval
    for (let t = first; t <= w.end; t += interval) {
      const left = ((t - w.start) / w.span) * 100
      out.push({ t, left, label: formatTickLabel(t - w.start) })
    }
    return out
  })

  return (
    <div
      style={{
        height: `${OVERVIEW_HEIGHT}px`,
        background: 'var(--bg-secondary)',
        'border-bottom': '1px solid var(--border)',
        position: 'relative',
        'user-select': 'none',
        'flex-shrink': 0,
      }}
    >
      <Show
        when={props.window}
        fallback={
          <div
            style={{
              height: '100%',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              color: 'var(--text-muted)',
              'font-size': '11px',
            }}
          >
            no traffic yet
          </div>
        }
      >
        {(w) => (
          <>
            {/* Tick labels */}
            <div
              style={{
                height: `${OVERVIEW_LABEL_HEIGHT}px`,
                position: 'relative',
                'border-bottom': '1px solid var(--border)',
                'font-size': '10px',
                color: 'var(--text-secondary)',
              }}
            >
              <For each={ticks()}>
                {(tick) => (
                  <span
                    style={{
                      position: 'absolute',
                      left: `${tick.left}%`,
                      top: '2px',
                      transform: 'translateX(-50%)',
                      'white-space': 'nowrap',
                      padding: '0 2px',
                      background: 'var(--bg-secondary)',
                    }}
                  >
                    {tick.label}
                  </span>
                )}
              </For>
            </div>

            {/* Activity strip */}
            <div
              ref={stripRef}
              onMouseDown={handleStripMouseDown}
              onDblClick={handleDoubleClick}
              style={{
                position: 'relative',
                height: `${OVERVIEW_HEIGHT - OVERVIEW_LABEL_HEIGHT}px`,
                cursor: 'crosshair',
                overflow: 'hidden',
                'background-image': `repeating-linear-gradient(
                  to right,
                  transparent 0,
                  transparent calc(10% - 1px),
                  var(--border) calc(10% - 1px),
                  var(--border) 10%
                )`,
              }}
            >
              <Show when={placedRows().some((p) => p.overflow)}>
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: `${LANE_TOP_PADDING + OVERFLOW_LANE * LANE_STRIDE - 1}px`,
                    height: '1px',
                    'border-top': '1px dashed var(--border)',
                    'pointer-events': 'none',
                  }}
                />
              </Show>
              <For each={placedRows()}>
                {(placed) => (
                  <OverviewBar
                    row={placed.row}
                    lane={placed.lane}
                    overflow={placed.overflow}
                    window={w()}
                    highlighted={props.selectedRowId === placed.row.id}
                  />
                )}
              </For>

              <Show when={selectionPair()}>
                {(pair) => (
                  <SelectionChrome
                    start={pair().start}
                    end={pair().end}
                    window={w()}
                    onPaddleMouseDown={handlePaddleMouseDown}
                    onBandMouseDown={handleBandMouseDown}
                    onReset={() => props.onClearSelection()}
                  />
                )}
              </Show>
            </div>
          </>
        )}
      </Show>
    </div>
  )
}

const OverviewBar: Component<{
  row: NetworkRow
  lane: number
  overflow: boolean
  window: TimeWindow
  highlighted: boolean
}> = (props) => {
  const start = rowStart(props.row)
  const end = rowEnd(props.row)
  const left = clamp01((start - props.window.start) / props.window.span) * 100
  const width = Math.max(0.2, clamp01((end - start) / props.window.span) * 100)
  const color = barColor(props.row)
  // Single-point events (ws frames, ws lifecycle): render as a 2px-wide tick.
  const isPoint = end === start
  const top = LANE_TOP_PADDING + props.lane * LANE_STRIDE
  return (
    <span
      style={{
        position: 'absolute',
        left: `${left}%`,
        width: isPoint ? '2px' : `${width}%`,
        top: `${top}px`,
        height: `${LANE_ITEM_HEIGHT}px`,
        background: color,
        opacity: props.highlighted ? 1 : props.overflow ? 0.55 : 0.85,
        'border-radius': props.overflow ? '0' : '1px',
        'min-width': '1px',
        'pointer-events': 'none',
        outline: props.highlighted ? '1px solid var(--text-primary)' : 'none',
        'z-index': props.highlighted ? 3 : props.overflow ? 2 : 1,
      }}
    />
  )
}

function rowStart(row: NetworkRow): number {
  return row.kind === 'http' ? (row.startedAt ?? row.timestamp) : row.timestamp
}

function rowEnd(row: NetworkRow): number {
  if (row.kind === 'http') {
    return row.finishedAt ?? row.failedAt ?? row.respondedAt ?? rowStart(row)
  }
  return row.timestamp
}

const SelectionChrome: Component<{
  start: number
  end: number
  window: TimeWindow
  onPaddleMouseDown: (side: 'left' | 'right', e: MouseEvent) => void
  onBandMouseDown: (e: MouseEvent) => void
  onReset: () => void
}> = (props) => {
  const leftPct = () => clamp01((props.start - props.window.start) / props.window.span) * 100
  const rightPct = () => clamp01((props.end - props.window.start) / props.window.span) * 100
  return (
    <>
      {/* Dim region: left of selection */}
      <span
        style={{
          position: 'absolute',
          left: 0,
          width: `${leftPct()}%`,
          top: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          'pointer-events': 'none',
          'z-index': 4,
        }}
      />
      {/* Dim region: right of selection */}
      <span
        style={{
          position: 'absolute',
          left: `${rightPct()}%`,
          right: 0,
          top: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          'pointer-events': 'none',
          'z-index': 4,
        }}
      />
      {/* Draggable band between paddles */}
      <span
        onMouseDown={(e) => props.onBandMouseDown(e)}
        style={{
          position: 'absolute',
          left: `${leftPct()}%`,
          width: `${Math.max(0, rightPct() - leftPct())}%`,
          top: 0,
          bottom: 0,
          background: 'rgba(59, 130, 246, 0.10)',
          cursor: 'grab',
          'z-index': 5,
        }}
      />
      <Paddle side="left" positionPct={leftPct()} onMouseDown={props.onPaddleMouseDown} />
      <Paddle side="right" positionPct={rightPct()} onMouseDown={props.onPaddleMouseDown} />
      {/* Reset button — clears the selection */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          props.onReset()
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title="Clear time selection"
        style={{
          position: 'absolute',
          left: `calc(${rightPct()}% + 8px)`,
          top: '2px',
          width: '18px',
          height: '18px',
          'line-height': '14px',
          padding: 0,
          'font-size': '12px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-strong)',
          'border-radius': '3px',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          'z-index': 7,
        }}
      >
        ×
      </button>
    </>
  )
}

const Paddle: Component<{
  side: 'left' | 'right'
  positionPct: number
  onMouseDown: (side: 'left' | 'right', e: MouseEvent) => void
}> = (props) => (
  <span
    onMouseDown={(e) => props.onMouseDown(props.side, e)}
    style={{
      position: 'absolute',
      left: `calc(${props.positionPct}% - 4px)`,
      top: 0,
      bottom: 0,
      width: '8px',
      background: 'var(--status-sending)',
      cursor: 'ew-resize',
      'z-index': 6,
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      'border-radius': '2px',
      'box-shadow': '0 0 0 1px rgba(0, 0, 0, 0.3)',
    }}
  >
    {/* Grip marks */}
    <span
      style={{
        display: 'flex',
        gap: '2px',
        'pointer-events': 'none',
      }}
    >
      <span style={{ width: '1px', height: '10px', background: 'rgba(255, 255, 255, 0.7)' }} />
      <span style={{ width: '1px', height: '10px', background: 'rgba(255, 255, 255, 0.7)' }} />
    </span>
  </span>
)

function barColor(row: NetworkRow): string {
  if (row.kind === 'http') {
    if (row.errorText) return 'var(--status-failed)'
    const s = row.status
    if (s === undefined) return 'var(--status-sending)'
    if (s >= 500) return 'var(--status-failed)'
    if (s >= 400) return 'var(--status-pending)'
    if (s >= 300) return 'var(--status-sending)'
    return 'var(--status-succeeded)'
  }
  if (row.kind === 'ws-frame') {
    return row.direction === 'sent' ? 'var(--status-sending)' : 'var(--status-succeeded)'
  }
  return 'var(--text-muted)'
}

function chooseTickInterval(spanMs: number): number {
  const candidates: readonly number[] = [
    50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000, 60000, 120000, 300000, 600000, 1800000,
    3600000,
  ]
  let largest = 3600000
  for (const c of candidates) {
    if (spanMs / c <= 10) return c
    largest = c
  }
  return largest
}

function formatTickLabel(ms: number): string {
  return formatMs(ms)
}

// ---------------------------------------------------------------------------
// Row list
// ---------------------------------------------------------------------------

interface TimeWindow {
  start: number
  end: number
  span: number
}

const HeaderRow: Component<{ columns: ColumnDef[]; gridTemplate: string }> = (props) => (
  <div
    style={{
      display: 'grid',
      'grid-template-columns': props.gridTemplate,
      'font-size': '11px',
      'font-weight': '600',
      color: 'var(--text-secondary)',
      padding: '4px 8px',
      'border-bottom': '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      background: 'var(--bg-primary)',
      'z-index': 1,
    }}
  >
    <For each={props.columns}>
      {(col) => <span style={{ 'text-align': col.align ?? 'left' }}>{col.label}</span>}
    </For>
  </div>
)

const NetworkRowView: Component<{
  row: NetworkRow
  selected: boolean
  onSelect: () => void
  onContextMenu: (e: MouseEvent) => void
  columns: ColumnDef[]
  gridTemplate: string
}> = (props) => (
  <div
    data-network-row-id={props.row.id}
    onClick={() => props.onSelect()}
    onContextMenu={(e) => props.onContextMenu(e)}
    style={{
      display: 'grid',
      'grid-template-columns': props.gridTemplate,
      'font-size': '11px',
      padding: '3px 8px',
      cursor: 'pointer',
      'border-bottom': '1px solid var(--border)',
      background: props.selected ? 'var(--bg-selected)' : 'transparent',
      'align-items': 'center',
      // Leave room for the sticky header (≈22px) so scrollIntoView with
      // block:'nearest' doesn't park the row underneath it.
      'scroll-margin-top': '24px',
    }}
  >
    <For each={props.columns}>
      {(col) => (
        <span
          title={col.cellTitle?.(props.row)}
          style={{
            'text-align': col.align ?? 'left',
            overflow: 'hidden',
            'text-overflow': 'ellipsis',
            'white-space': 'nowrap',
          }}
        >
          {col.cell(props.row)}
        </span>
      )}
    </For>
  </div>
)

// ---------------------------------------------------------------------------
// Per-column cell renderers
// ---------------------------------------------------------------------------

function renderName(row: NetworkRow): JSX.Element {
  if (row.kind === 'http') {
    return urlBasename(row.url) || row.url
  }
  if (row.kind === 'ws-frame') {
    return (
      <span style={{ 'font-family': 'monospace' }}>
        {row.payloadPreview || `frame ${row.frameSeq}`}
      </span>
    )
  }
  return `WS ${row.phase}${row.url ? ` · ${urlBasename(row.url)}` : ''}`
}

function renderMethod(row: NetworkRow): JSX.Element {
  if (row.kind === 'http') return row.method
  if (row.kind === 'ws-frame') {
    const color = row.direction === 'sent' ? 'var(--status-sending)' : 'var(--status-succeeded)'
    return <span style={{ color }}>{row.direction === 'sent' ? '↑ send' : '↓ recv'}</span>
  }
  return (
    <span style={{ color: 'var(--text-muted)' }}>{row.phase === 'created' ? 'open' : 'close'}</span>
  )
}

function renderStatus(row: NetworkRow): JSX.Element {
  if (row.kind !== 'http') return ''
  const text = row.errorText
    ? (row.blockedReason ?? 'failed')
    : row.status !== undefined
      ? `${row.status}`
      : '—'
  const color = statusColor(row)
  return color ? <span style={{ color }}>{text}</span> : text
}

function renderType(row: NetworkRow): JSX.Element {
  const text =
    row.kind === 'http'
      ? (row.resourceType ?? row.mimeType ?? 'http')
      : row.kind === 'ws-frame'
        ? opcodeLabel(row.opcode)
        : 'ws'
  return <span style={{ color: 'var(--text-secondary)' }}>{text}</span>
}

function renderInitiator(row: NetworkRow): string {
  if (row.kind === 'http') return row.initiatorUrl ?? row.initiatorType ?? ''
  if (row.kind === 'ws-lifecycle') return row.initiatorUrl ?? ''
  return ''
}

function renderRemoteAddress(row: NetworkRow): string {
  if (row.kind !== 'http' || !row.remoteIpAddress) return ''
  return row.remotePort !== undefined
    ? `${row.remoteIpAddress}:${row.remotePort}`
    : row.remoteIpAddress
}

function renderSize(row: NetworkRow): string {
  if (row.kind === 'http' && row.encodedDataLength !== undefined) {
    return formatBytes(row.encodedDataLength)
  }
  if (row.kind === 'ws-frame') return formatBytes(row.payloadSize)
  return ''
}

function renderTime(row: NetworkRow): string {
  if (row.kind !== 'http') return ''
  const end = row.finishedAt ?? row.failedAt ?? row.respondedAt
  if (row.startedAt === undefined || end === undefined) return ''
  return formatMs(end - row.startedAt)
}

function httpOrLifecycleUrl(row: NetworkRow): string | undefined {
  if (row.kind === 'http') return row.url
  if (row.kind === 'ws-lifecycle') return row.url
  if (row.kind === 'ws-frame') return row.wsUrl
  return undefined
}

/**
 * Count cookies in a Cookie request header or Set-Cookie response header.
 * CDP collapses multi-valued response headers into one entry joined by '\n';
 * the request Cookie header is a single value with cookies joined by '; '.
 * Returns '' for zero so the cell stays visually quiet when no cookies flow.
 */
function renderCookieCount(row: NetworkRow, side: 'request' | 'response'): string {
  if (row.kind !== 'http') return ''
  const headers = side === 'request' ? row.requestHeaders : row.responseHeaders
  if (!headers) return ''
  const target = side === 'request' ? 'cookie' : 'set-cookie'
  let raw: string | undefined
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === target) {
      raw = headers[k]
      break
    }
  }
  if (!raw) return ''
  const separator = side === 'request' ? ';' : '\n'
  const count = raw
    .split(separator)
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length
  return count > 0 ? String(count) : ''
}

function urlPath(url: string): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    return u.search ? `${u.pathname}${u.search}` : u.pathname
  } catch {
    return url
  }
}

function urlScheme(url: string): string {
  if (!url) return ''
  try {
    return new URL(url).protocol.replace(':', '')
  } catch {
    return ''
  }
}

function urlDomain(url: string): string {
  if (!url) return ''
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Waterfall
// ---------------------------------------------------------------------------

const Waterfall: Component<{ row: NetworkRow; window: TimeWindow | undefined }> = (props) => {
  const bar = (): JSX.Element => {
    const w = props.window
    if (!w) return null
    const row = props.row
    const start = row.kind === 'http' ? (row.startedAt ?? row.timestamp) : row.timestamp
    const end =
      row.kind === 'http' ? (row.finishedAt ?? row.failedAt ?? row.respondedAt ?? start) : start
    const left = clamp01((start - w.start) / w.span) * 100
    const width = Math.max(0.4, clamp01((end - start) / w.span) * 100)
    const color =
      row.kind === 'ws-frame'
        ? row.direction === 'sent'
          ? 'var(--status-sending)'
          : 'var(--status-succeeded)'
        : row.kind === 'ws-lifecycle'
          ? 'var(--text-muted)'
          : row.kind === 'http' && row.errorText
            ? 'var(--status-failed)'
            : 'var(--status-sending)'
    return (
      <span
        style={{
          position: 'absolute',
          left: `${left}%`,
          width: `${width}%`,
          top: '5px',
          height: '6px',
          background: color,
          'border-radius': '2px',
          'min-width': '2px',
        }}
      />
    )
  }
  return <div style={{ position: 'relative', height: '16px', width: '100%' }}>{bar()}</div>
}

// ---------------------------------------------------------------------------
// Detail pane
// ---------------------------------------------------------------------------

const DetailPane: Component<{ row: NetworkRow }> = (props) => {
  return (
    <div style={{ 'padding-top': '4px' }}>
      <Show when={props.row.kind === 'http'}>
        <HttpDetail row={props.row as HttpRow} />
      </Show>
      <Show when={props.row.kind === 'ws-frame'}>
        <FrameDetail row={props.row as WsFrameRow} />
      </Show>
      <Show when={props.row.kind === 'ws-lifecycle'}>
        <LifecycleDetail row={props.row as WsLifecycleRow} />
      </Show>
    </div>
  )
}

type HttpDetailTab = 'headers' | 'payload' | 'response' | 'initiator' | 'timing'

const HTTP_DETAIL_TABS: { id: HttpDetailTab; label: string }[] = [
  { id: 'headers', label: 'Headers' },
  { id: 'payload', label: 'Payload' },
  { id: 'response', label: 'Response' },
  { id: 'initiator', label: 'Initiator' },
  { id: 'timing', label: 'Timing' },
]

const HttpDetail: Component<{ row: HttpRow }> = (props) => {
  const [tab, setTab] = createSignal<HttpDetailTab>('headers')
  return (
    <>
      <DetailTabBar tabs={HTTP_DETAIL_TABS} active={tab()} onSelect={(id) => setTab(id)} />
      <Show when={tab() === 'headers'}>
        <HttpHeadersView row={props.row} />
      </Show>
      <Show when={tab() === 'payload'}>
        <HttpPayloadView row={props.row} />
      </Show>
      <Show when={tab() === 'response'}>
        <HttpResponseView row={props.row} />
      </Show>
      <Show when={tab() === 'initiator'}>
        <HttpInitiatorView row={props.row} />
      </Show>
      <Show when={tab() === 'timing'}>
        <TimingChart row={props.row} />
      </Show>
    </>
  )
}

const DetailTabBar: Component<{
  tabs: { id: HttpDetailTab; label: string }[]
  active: HttpDetailTab
  onSelect: (id: HttpDetailTab) => void
}> = (props) => (
  <div
    style={{
      display: 'flex',
      'border-bottom': '1px solid var(--border)',
      'margin-bottom': '8px',
      gap: '2px',
    }}
  >
    <For each={props.tabs}>
      {(t) => (
        <button
          onClick={() => props.onSelect(t.id)}
          style={{
            background: 'transparent',
            color: 'inherit',
            border: 'none',
            'border-bottom':
              props.active === t.id ? '2px solid var(--status-sending)' : '2px solid transparent',
            padding: '5px 12px',
            cursor: 'pointer',
            'font-size': '11px',
            'font-weight': props.active === t.id ? '600' : '400',
          }}
        >
          {t.label}
        </button>
      )}
    </For>
  </div>
)

const HttpHeadersView: Component<{ row: HttpRow }> = (props) => (
  <>
    <Section title="General">
      <Field k="URL" v={props.row.url} />
      <Field k="Method" v={props.row.method} />
      <Field
        k="Status"
        v={
          props.row.errorText
            ? `${props.row.errorText}${props.row.blockedReason ? ` (${props.row.blockedReason})` : ''}`
            : props.row.status !== undefined
              ? `${props.row.status} ${props.row.statusText ?? ''}`
              : '—'
        }
      />
      <Field k="Type" v={props.row.resourceType ?? props.row.mimeType ?? ''} />
      <Field k="Source" v={`${props.row.source} · ${props.row.session.targetType}`} />
      <Field
        k="Remote"
        v={
          props.row.remoteIpAddress
            ? `${props.row.remoteIpAddress}:${props.row.remotePort ?? '?'}`
            : ''
        }
      />
      <Field
        k="Size"
        v={
          props.row.encodedDataLength !== undefined ? formatBytes(props.row.encodedDataLength) : ''
        }
      />
    </Section>

    <Show when={Object.keys(props.row.requestHeaders ?? {}).length > 0}>
      <Section title="Request headers">
        <HeaderList headers={props.row.requestHeaders ?? {}} />
      </Section>
    </Show>

    <Show when={Object.keys(props.row.responseHeaders ?? {}).length > 0}>
      <Section title="Response headers">
        <HeaderList headers={props.row.responseHeaders ?? {}} />
      </Section>
    </Show>
  </>
)

const HttpPayloadView: Component<{ row: HttpRow }> = (props) => (
  <Show
    when={props.row.requestBodyPreview}
    fallback={
      <div style={{ color: 'var(--text-muted)', 'font-size': '11px', padding: '8px 0' }}>
        No request body captured.
      </div>
    }
  >
    <pre
      style={{
        'white-space': 'pre-wrap',
        'word-break': 'break-all',
        margin: 0,
        'font-size': '11px',
        'font-family': 'monospace',
      }}
    >
      {props.row.requestBodyPreview}
    </pre>
  </Show>
)

const HttpResponseView: Component<{ row: HttpRow }> = (props) => {
  const formatted = () => prettyResponseBody(props.row)
  return (
    <Show
      when={props.row.responseBody !== undefined}
      fallback={
        <div style={{ color: 'var(--text-muted)', 'font-size': '11px', padding: '8px 0' }}>
          <Show
            when={props.row.finishedAt !== undefined || props.row.failedAt !== undefined}
            fallback="Response in flight…"
          >
            <Show
              when={props.row.failedAt !== undefined}
              fallback="No response body captured (binary resource type or eviction)."
            >
              Request failed; no response body.
            </Show>
          </Show>
        </div>
      }
    >
      <div style={{ 'font-size': '11px' }}>
        <Show when={props.row.responseBodyTruncated}>
          <div
            style={{
              color: 'var(--banner-warning-text)',
              background: 'var(--banner-warning-bg)',
              border: '1px solid var(--banner-warning-border)',
              padding: '4px 6px',
              'border-radius': '3px',
              'margin-bottom': '6px',
            }}
          >
            Body truncated at 100 KB for transfer to the panel.
          </div>
        </Show>
        <Show when={props.row.responseBodyBase64}>
          <div style={{ color: 'var(--text-muted)', 'margin-bottom': '6px' }}>
            Binary content, base64-encoded ({(props.row.responseBody ?? '').length} chars).
          </div>
        </Show>
        <pre
          style={{
            'white-space': 'pre-wrap',
            'word-break': 'break-all',
            margin: 0,
            'font-size': '11px',
            'font-family': 'monospace',
          }}
        >
          {formatted()}
        </pre>
      </div>
    </Show>
  )
}

function prettyResponseBody(row: HttpRow): string {
  const body = row.responseBody ?? ''
  if (row.responseBodyBase64) return body
  const mime = (row.mimeType ?? '').toLowerCase()
  if (!mime.includes('json')) return body
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

const HttpInitiatorView: Component<{ row: HttpRow }> = (props) => (
  <Section title="Initiator">
    <Field k="Type" v={props.row.initiatorType ?? ''} />
    <Field k="URL" v={props.row.initiatorUrl ?? ''} />
    <Field k="Target" v={`${props.row.source} · ${props.row.session.targetType}`} />
    <Field k="Target URL" v={props.row.session.targetUrl} />
  </Section>
)

// ---------------------------------------------------------------------------
// HTTP row context menu
// ---------------------------------------------------------------------------

function buildHttpMenu(row: HttpRow): MenuItem[] {
  const copy =
    (text: string): (() => void) =>
    () => {
      void navigator.clipboard.writeText(text)
    }
  return [
    {
      label: 'Open in new tab',
      action: () => {
        window.open(row.url, '_blank', 'noopener,noreferrer')
      },
    },
    { kind: 'separator' },
    { label: 'Copy URL', action: copy(row.url) },
    { label: 'Copy as cURL', action: copy(toCurl(row)) },
    { label: 'Copy as fetch', action: copy(toFetch(row)) },
    { label: 'Copy as fetch (Node.js)', action: copy(toFetchNode(row)) },
    { label: 'Copy as PowerShell', action: copy(toPowerShell(row)) },
    { kind: 'separator' },
    {
      label: 'Copy request headers',
      action: copy(JSON.stringify(row.requestHeaders ?? {}, null, 2)),
      disabled: Object.keys(row.requestHeaders ?? {}).length === 0,
    },
    {
      label: 'Copy response headers',
      action: copy(JSON.stringify(row.responseHeaders ?? {}, null, 2)),
      disabled: Object.keys(row.responseHeaders ?? {}).length === 0,
    },
    {
      label: 'Copy response body',
      action: copy(row.responseBody ?? ''),
      disabled: row.responseBody === undefined || row.responseBody.length === 0,
    },
    { kind: 'separator' },
    { label: 'Copy as HAR fragment', action: copy(toHarFragment(row)) },
  ]
}

const FrameDetail: Component<{ row: WsFrameRow }> = (props) => (
  <>
    <Section title="Frame">
      <Field k="Direction" v={props.row.direction} />
      <Field k="Frame #" v={String(props.row.frameSeq)} />
      <Field k="Opcode" v={`${props.row.opcode} (${opcodeLabel(props.row.opcode)})`} />
      <Field k="Mask" v={String(props.row.mask)} />
      <Field k="Size" v={formatBytes(props.row.payloadSize)} />
      <Field k="Connection" v={props.row.connectionId} />
      <Field k="Source" v={`${props.row.source} · ${props.row.session.targetType}`} />
      <Field k="Time" v={new Date(props.row.timestamp).toISOString()} />
    </Section>
    <Show when={props.row.payloadPreview}>
      <Section title="Payload">
        <pre
          style={{
            'white-space': 'pre-wrap',
            'word-break': 'break-all',
            margin: 0,
            'font-size': '11px',
            'font-family': 'monospace',
          }}
        >
          {props.row.payloadPreview}
        </pre>
      </Section>
    </Show>
  </>
)

const LifecycleDetail: Component<{ row: WsLifecycleRow }> = (props) => (
  <Section title={`WebSocket ${props.row.phase}`}>
    <Field k="URL" v={props.row.url ?? ''} />
    <Field k="Connection" v={props.row.connectionId} />
    <Field k="Initiator" v={props.row.initiatorUrl ?? ''} />
    <Field k="Source" v={`${props.row.source} · ${props.row.session.targetType}`} />
    <Field k="Time" v={new Date(props.row.timestamp).toISOString()} />
  </Section>
)

const Section: Component<{ title: string; children: JSX.Element }> = (props) => (
  <div style={{ 'margin-bottom': '12px' }}>
    <div
      style={{
        'font-weight': '600',
        'font-size': '11px',
        color: 'var(--text-secondary)',
        'text-transform': 'uppercase',
        'letter-spacing': '0.5px',
        'border-bottom': '1px solid var(--border)',
        'padding-bottom': '2px',
        'margin-bottom': '4px',
      }}
    >
      {props.title}
    </div>
    {props.children}
  </div>
)

const Field: Component<{ k: string; v: string }> = (props) => (
  <Show when={props.v}>
    <div
      style={{
        display: 'grid',
        'grid-template-columns': '100px 1fr',
        gap: '6px',
        margin: '2px 0',
      }}
    >
      <span style={{ color: 'var(--text-secondary)' }}>{props.k}</span>
      <span style={{ 'word-break': 'break-all' }}>{props.v}</span>
    </div>
  </Show>
)

const HeaderList: Component<{ headers: Record<string, string> }> = (props) => (
  <For each={Object.keys(props.headers)}>
    {(k) => (
      <div
        style={{
          display: 'grid',
          'grid-template-columns': '160px 1fr',
          gap: '6px',
          margin: '1px 0',
          'font-family': 'monospace',
        }}
      >
        <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
        <span style={{ 'word-break': 'break-all' }}>{props.headers[k]}</span>
      </div>
    )}
  </For>
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function urlBasename(url: string | undefined): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    const segments = u.pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    if (last) return u.search ? `${last}${u.search}` : last
    return u.host
  } catch {
    return url
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function statusColor(row: HttpRow): string | undefined {
  if (row.errorText) return 'var(--status-failed)'
  const s = row.status
  if (s === undefined) return undefined
  if (s >= 500) return 'var(--status-failed)'
  if (s >= 400) return 'var(--status-pending)'
  if (s >= 300) return 'var(--status-sending)'
  if (s >= 200) return 'var(--status-succeeded)'
  return undefined
}

function opcodeLabel(opcode: number): string {
  switch (opcode) {
    case 0:
      return 'cont'
    case 1:
      return 'text'
    case 2:
      return 'binary'
    case 8:
      return 'close'
    case 9:
      return 'ping'
    case 10:
      return 'pong'
    default:
      return `opcode ${opcode}`
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}
