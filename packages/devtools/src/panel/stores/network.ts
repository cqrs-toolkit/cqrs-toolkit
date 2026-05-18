/**
 * Network panel store — discriminated row model.
 *
 * Three row kinds:
 *  - http               one row per HTTP request, lifecycle events merged
 *  - ws-lifecycle       one row per WS open/close
 *  - ws-frame           one row per WS frame send/receive
 *
 * Two ingest paths:
 *  - applyEvent(NetworkProbeEvent)  CDP path from chrome.debugger
 *  - applyHttpRow(HttpRow)          HAR path from chrome.devtools.network
 *
 * Three independent filters:
 *  - global    matches any row
 *  - http      restricts http rows
 *  - ws        restricts ws rows (both lifecycle and frame)
 */

import { createMemo, createSignal } from 'solid-js'
import type {
  NetCaptureState,
  NetEventTargetAttached,
  NetEventTargetDetached,
  NetSessionInfo,
  NetworkProbeEvent,
} from '../../shared/protocol.js'

export type RowSource = 'page' | 'worker'

interface RowBase {
  /** Globally unique row id. */
  id: string
  /** Wall-clock epoch ms — for sort + time-axis. */
  timestamp: number
  /** Simplified attribution shown in the Source column. */
  source: RowSource
  /** Full session detail for tooltip/detail view. */
  session: NetSessionInfo
}

export interface HttpRow extends RowBase {
  kind: 'http'
  url: string
  method: string
  status?: number
  statusText?: string
  resourceType?: string
  mimeType?: string
  remoteIpAddress?: string
  remotePort?: number
  fromDiskCache?: boolean
  fromServiceWorker?: boolean
  initiatorType?: string
  initiatorUrl?: string
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
  requestBodyPreview?: string
  responseBody?: string
  responseBodyBase64?: boolean
  responseBodyTruncated?: boolean
  encodedDataLength?: number
  /** CDP-format timing: dns/connect/ssl/send/wait/receive (ms). */
  timing?: Record<string, number>
  startedAt?: number
  respondedAt?: number
  finishedAt?: number
  failedAt?: number
  errorText?: string
  blockedReason?: string
  /** Raw event log; only populated by CDP path. */
  events: NetworkProbeEvent[]
}

export interface WsLifecycleRow extends RowBase {
  kind: 'ws-lifecycle'
  phase: 'created' | 'closed'
  /** Connection's recordId (sessionId:requestId) — links frames to lifecycle. */
  connectionId: string
  url?: string
  initiatorUrl?: string
}

export interface WsFrameRow extends RowBase {
  kind: 'ws-frame'
  direction: 'sent' | 'received'
  connectionId: string
  /** Index within the connection (1-based). */
  frameSeq: number
  opcode: number
  mask: boolean
  payloadSize: number
  payloadPreview?: string
  /** URL of the connection this frame belongs to, when known. */
  wsUrl?: string
}

export type NetworkRow = HttpRow | WsLifecycleRow | WsFrameRow

export interface NetworkSessionEntry {
  session: NetSessionInfo
  attachedAt: number
  detachedAt?: number
  waitingForDebugger: boolean
}

export interface NetworkStore {
  rows: () => NetworkRow[]
  filteredRows: () => NetworkRow[]
  sessions: () => NetworkSessionEntry[]
  captureState: () => NetCaptureState

  selectedId: () => string | undefined
  selectRow: (id: string | undefined) => void
  selectedRow: () => NetworkRow | undefined

  globalFilter: () => string
  setGlobalFilter: (v: string) => void
  httpFilter: () => string
  setHttpFilter: (v: string) => void
  wsFilter: () => string
  setWsFilter: (v: string) => void
  showHttp: () => boolean
  setShowHttp: (v: boolean) => void
  showWs: () => boolean
  setShowWs: (v: boolean) => void

  /** Overview ruler selection (epoch ms). Both undefined = no selection. */
  selectionStart: () => number | undefined
  selectionEnd: () => number | undefined
  setSelectionRange: (start: number, end: number) => void
  clearSelectionRange: () => void

  /** Capture window start; rows' timestamps reference this for the waterfall. */
  captureStartedAt: () => number | undefined

  applyEvent: (event: NetworkProbeEvent) => void
  applyHttpRow: (row: HttpRow) => void
  applyState: (state: NetCaptureState) => void

  clear: () => void
  exportJson: () => string
}

export function createNetworkStore(): NetworkStore {
  const [rowsList, setRowsList] = createSignal<NetworkRow[]>([])
  const [httpIndex, setHttpIndex] = createSignal<Map<string, HttpRow>>(new Map())
  const [wsFrameCounts, setWsFrameCounts] = createSignal<Map<string, number>>(new Map())
  const [wsUrlByConnection, setWsUrlByConnection] = createSignal<Map<string, string>>(new Map())
  const [sessionsMap, setSessionsMap] = createSignal<Map<string, NetworkSessionEntry>>(new Map())
  const [captureState, setCaptureState] = createSignal<NetCaptureState>({ status: 'idle' })
  const [captureStartedAt, setCaptureStartedAt] = createSignal<number | undefined>()
  const [selectedId, setSelectedId] = createSignal<string | undefined>()

  const [globalFilter, setGlobalFilter] = createSignal('')
  const [httpFilter, setHttpFilter] = createSignal('')
  const [wsFilter, setWsFilter] = createSignal('')
  const [showHttp, setShowHttp] = createSignal(true)
  const [showWs, setShowWs] = createSignal(true)
  const [selectionStart, setSelectionStart] = createSignal<number | undefined>()
  const [selectionEnd, setSelectionEnd] = createSignal<number | undefined>()

  const filteredRows = createMemo(() => {
    const g = globalFilter().toLowerCase()
    const h = httpFilter().toLowerCase()
    const w = wsFilter().toLowerCase()
    const httpOn = showHttp()
    const wsOn = showWs()
    const selStart = selectionStart()
    const selEnd = selectionEnd()
    return rowsList().filter((row) => {
      if (row.kind === 'http' && !httpOn) return false
      if (row.kind !== 'http' && !wsOn) return false
      if (g && !rowMatches(row, g)) return false
      if (row.kind === 'http') {
        if (h && !rowMatches(row, h)) return false
      } else {
        if (w && !rowMatches(row, w)) return false
      }
      if (selStart !== undefined && selEnd !== undefined) {
        const rowStart = row.timestamp
        const rowEnd =
          row.kind === 'http'
            ? (row.finishedAt ?? row.failedAt ?? row.respondedAt ?? rowStart)
            : rowStart
        // Overlap test: row's [start, end] must intersect selection.
        if (rowEnd < selStart || rowStart > selEnd) return false
      }
      return true
    })
  })

  const sessions = createMemo(() => Array.from(sessionsMap().values()))

  function pushRow(row: NetworkRow): void {
    setRowsList((prev) => [...prev, row])
  }

  function replaceHttpRow(row: HttpRow): void {
    setRowsList((prev) => prev.map((r) => (r.id === row.id ? row : r)))
  }

  function applyEvent(event: NetworkProbeEvent): void {
    markCaptureStart(event.wallTime)
    switch (event.kind) {
      case 'target-attached':
        applyTargetAttached(event)
        return
      case 'target-detached':
        applyTargetDetached(event)
        return
    }

    // Infer the row source from the synthesised session.targetType.
    //   - Page-hook events (hook.ts projects with targetType: 'page'): page.
    //   - Worker-binding events (background projects with the worker's
    //     CDP targetType — 'shared_worker' / 'worker' / 'other'): worker.
    const source: RowSource = event.session.targetType === 'page' ? 'page' : 'worker'

    switch (event.kind) {
      case 'request-will-be-sent': {
        const row: HttpRow = {
          id: event.recordId,
          kind: 'http',
          timestamp: event.wallTime,
          source,
          session: event.session,
          url: event.url,
          method: event.method,
          requestHeaders: event.headers,
          requestBodyPreview: event.postDataPreview,
          resourceType: event.resourceType,
          initiatorType: event.initiatorType,
          initiatorUrl: event.initiatorUrl,
          startedAt: event.wallTime,
          events: [event],
        }
        setHttpIndex((prev) => {
          const next = new Map(prev)
          next.set(event.recordId, row)
          return next
        })
        pushRow(row)
        return
      }

      case 'response-received': {
        const existing = httpIndex().get(event.recordId)
        if (!existing) return
        const updated: HttpRow = {
          ...existing,
          status: event.status,
          statusText: event.statusText,
          responseHeaders: event.headers,
          mimeType: event.mimeType,
          resourceType: event.resourceType ?? existing.resourceType,
          remoteIpAddress: event.remoteIpAddress,
          remotePort: event.remotePort,
          fromDiskCache: event.fromDiskCache,
          fromServiceWorker: event.fromServiceWorker,
          encodedDataLength: event.encodedDataLength ?? existing.encodedDataLength,
          timing: event.timing,
          respondedAt: event.wallTime,
          events: [...existing.events, event],
        }
        setHttpIndex((prev) => {
          const next = new Map(prev)
          next.set(event.recordId, updated)
          return next
        })
        replaceHttpRow(updated)
        return
      }

      case 'loading-finished': {
        const existing = httpIndex().get(event.recordId)
        if (!existing) return
        const updated: HttpRow = {
          ...existing,
          encodedDataLength: event.encodedDataLength,
          finishedAt: event.wallTime,
          events: [...existing.events, event],
        }
        setHttpIndex((prev) => {
          const next = new Map(prev)
          next.set(event.recordId, updated)
          return next
        })
        replaceHttpRow(updated)
        return
      }

      case 'loading-failed': {
        const existing = httpIndex().get(event.recordId)
        if (!existing) return
        const updated: HttpRow = {
          ...existing,
          errorText: event.errorText,
          blockedReason: event.blockedReason,
          resourceType: event.resourceType ?? existing.resourceType,
          failedAt: event.wallTime,
          events: [...existing.events, event],
        }
        setHttpIndex((prev) => {
          const next = new Map(prev)
          next.set(event.recordId, updated)
          return next
        })
        replaceHttpRow(updated)
        return
      }

      case 'response-body': {
        const existing = httpIndex().get(event.recordId)
        if (!existing) return
        const updated: HttpRow = {
          ...existing,
          responseBody: event.body,
          responseBodyBase64: event.base64Encoded,
          responseBodyTruncated: event.truncated,
          events: [...existing.events, event],
        }
        setHttpIndex((prev) => {
          const next = new Map(prev)
          next.set(event.recordId, updated)
          return next
        })
        replaceHttpRow(updated)
        return
      }

      case 'ws-created': {
        setWsUrlByConnection((prev) => {
          const next = new Map(prev)
          next.set(event.recordId, event.url)
          return next
        })
        const row: WsLifecycleRow = {
          id: `${event.recordId}:open`,
          kind: 'ws-lifecycle',
          phase: 'created',
          timestamp: event.wallTime,
          source,
          session: event.session,
          connectionId: event.recordId,
          url: event.url,
          initiatorUrl: event.initiatorUrl,
        }
        pushRow(row)
        return
      }

      case 'ws-frame-sent':
      case 'ws-frame-received': {
        const seq = (wsFrameCounts().get(event.recordId) ?? 0) + 1
        setWsFrameCounts((prev) => {
          const next = new Map(prev)
          next.set(event.recordId, seq)
          return next
        })
        // Prefer the per-frame url when the source supplied it (library
        // `recordNetEvent` / injected worker patch). Falls back to the
        // wsUrlByConnection map populated from `ws-created` — that's the
        // only signal CDP-native frames carry.
        const knownUrl = event.url
        if (knownUrl && !wsUrlByConnection().has(event.recordId)) {
          setWsUrlByConnection((prev) => {
            const next = new Map(prev)
            next.set(event.recordId, knownUrl)
            return next
          })
        }
        const row: WsFrameRow = {
          id: `${event.recordId}:frame:${seq}`,
          kind: 'ws-frame',
          direction: event.kind === 'ws-frame-sent' ? 'sent' : 'received',
          timestamp: event.wallTime,
          source,
          session: event.session,
          connectionId: event.recordId,
          frameSeq: seq,
          opcode: event.opcode,
          mask: event.mask,
          payloadSize: event.payloadSize,
          payloadPreview: event.payloadPreview,
          wsUrl: knownUrl ?? wsUrlByConnection().get(event.recordId),
        }
        pushRow(row)
        return
      }

      case 'ws-closed': {
        const row: WsLifecycleRow = {
          id: `${event.recordId}:close`,
          kind: 'ws-lifecycle',
          phase: 'closed',
          timestamp: event.wallTime,
          source,
          session: event.session,
          connectionId: event.recordId,
          url: wsUrlByConnection().get(event.recordId),
        }
        pushRow(row)
        return
      }
    }
  }

  function applyHttpRow(row: HttpRow): void {
    markCaptureStart(row.timestamp)
    pushRow(row)
  }

  function markCaptureStart(t: number): void {
    if (captureStartedAt() === undefined) setCaptureStartedAt(t)
  }

  function applyTargetAttached(event: NetEventTargetAttached): void {
    setSessionsMap((prev) => {
      const next = new Map(prev)
      next.set(event.session.sessionId, {
        session: event.session,
        attachedAt: event.wallTime,
        waitingForDebugger: event.waitingForDebugger,
      })
      return next
    })
  }

  function applyTargetDetached(event: NetEventTargetDetached): void {
    setSessionsMap((prev) => {
      const existing = prev.get(event.session.sessionId)
      if (!existing) return prev
      const next = new Map(prev)
      next.set(event.session.sessionId, { ...existing, detachedAt: event.wallTime })
      return next
    })
  }

  function applyState(state: NetCaptureState): void {
    setCaptureState(state)
    if (state.status === 'attaching' || state.status === 'capturing') {
      if (captureStartedAt() === undefined) setCaptureStartedAt(Date.now())
    }
  }

  function clear(): void {
    setRowsList([])
    setHttpIndex(new Map())
    setWsFrameCounts(new Map())
    setWsUrlByConnection(new Map())
    setSessionsMap(new Map())
    setCaptureStartedAt(undefined)
    setSelectedId(undefined)
    setSelectionStart(undefined)
    setSelectionEnd(undefined)
  }

  function exportJson(): string {
    return JSON.stringify(
      {
        sessions: Array.from(sessionsMap().values()),
        rows: rowsList(),
      },
      null,
      2,
    )
  }

  return {
    rows: rowsList,
    filteredRows,
    sessions,
    captureState,
    selectedId,
    selectRow: setSelectedId,
    selectedRow() {
      const id = selectedId()
      if (!id) return undefined
      return rowsList().find((r) => r.id === id)
    },
    globalFilter,
    setGlobalFilter,
    httpFilter,
    setHttpFilter,
    wsFilter,
    setWsFilter,
    showHttp,
    setShowHttp,
    showWs,
    setShowWs,
    selectionStart,
    selectionEnd,
    setSelectionRange(start, end) {
      const lo = Math.min(start, end)
      const hi = Math.max(start, end)
      setSelectionStart(lo)
      setSelectionEnd(hi)
    },
    clearSelectionRange() {
      setSelectionStart(undefined)
      setSelectionEnd(undefined)
    },
    captureStartedAt,
    applyEvent,
    applyHttpRow,
    applyState,
    clear,
    exportJson,
  }
}

function rowMatches(row: NetworkRow, needle: string): boolean {
  if (!needle) return true
  switch (row.kind) {
    case 'http':
      return (
        row.url.toLowerCase().includes(needle) ||
        row.method.toLowerCase().includes(needle) ||
        (row.status !== undefined && String(row.status).includes(needle)) ||
        (row.resourceType?.toLowerCase().includes(needle) ?? false) ||
        (row.mimeType?.toLowerCase().includes(needle) ?? false) ||
        row.source.includes(needle)
      )
    case 'ws-frame':
      return (
        (row.payloadPreview?.toLowerCase().includes(needle) ?? false) ||
        row.direction.includes(needle) ||
        row.source.includes(needle)
      )
    case 'ws-lifecycle':
      return (
        row.phase.includes(needle) ||
        (row.url?.toLowerCase().includes(needle) ?? false) ||
        row.source.includes(needle)
      )
  }
}
