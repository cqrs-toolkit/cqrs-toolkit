import type { Component } from 'solid-js'
import type { EventBusEntry } from '../../stores/eventBus.js'
import { formatTime } from '../../utils/format.js'

interface EventBusRowProps {
  entry: EventBusEntry
  columns: string
  selected: boolean
  onSelect: () => void
}

export const EventBusRow: Component<EventBusRowProps> = (props) => {
  const ck = () => extractCacheKey(props.entry.event.data)

  return (
    <div
      class={`bus-row ${props.selected ? 'selected' : ''}`}
      style={{ display: 'grid', 'grid-template-columns': props.columns }}
      onClick={() => props.onSelect()}
    >
      <span class="bus-col-time">{formatTime(props.entry.event.timestamp)}</span>
      <span
        class={`bus-col-type bus-type-badge bus-prefix-${getPrefixColor(props.entry.event.type)}`}
      >
        {props.entry.event.type}
      </span>
      <span class="bus-col-debug">{props.entry.event.debug ? 'DBG' : ''}</span>
      <span class="bus-col-kind">{ck()?.kind ?? ''}</span>
      <span class="bus-col-target">{ck()?.target ?? ''}</span>
      <span class="bus-col-data">{summarizeData(props.entry.event.data)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPrefixColor(type: string): string {
  const i = type.indexOf(':')
  const prefix = i === -1 ? type : type.slice(0, i)

  switch (prefix) {
    case 'command':
      return 'command'
    case 'sync':
      return 'sync'
    case 'cache':
      return 'cache'
    case 'ws':
      return 'ws'
    case 'connectivity':
      return 'connectivity'
    case 'session':
      return 'session'
    case 'readmodel':
      return 'readmodel'
    case 'error':
      return 'error'
    default:
      return 'neutral'
  }
}

function summarizeData(data: Record<string, unknown>): string {
  try {
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}

function extractCacheKey(
  data: Record<string, unknown>,
): { kind: string; target: string } | undefined {
  if (typeof data.cacheKey !== 'object' || data.cacheKey === null) return undefined
  const ck = data.cacheKey as Record<string, unknown>
  const kind = ck.kind
  if (kind === 'entity') {
    const link = ck.link as Record<string, unknown> | undefined
    if (!link) return { kind: 'entity', target: '' }
    const service = typeof link.service === 'string' ? link.service : undefined
    const type = typeof link.type === 'string' ? link.type : ''
    return { kind: 'entity', target: service ? `${service}.${type}` : type }
  }
  if (kind === 'scope') {
    const scopeType = typeof ck.scopeType === 'string' ? ck.scopeType : ''
    return { kind: 'scope', target: scopeType }
  }
  return undefined
}
