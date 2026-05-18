import { createMemo, For, Show, type Component } from 'solid-js'
import type { HttpRow } from '../../stores/network.js'
import { computeTimingBreakdown, formatMs, type TimingPhase } from './timing.js'

interface TimingChartProps {
  row: HttpRow
}

export const TimingChart: Component<TimingChartProps> = (props) => {
  const data = createMemo(() => computeTimingBreakdown(props.row))

  return (
    <div style={{ 'padding-top': '4px' }}>
      <Show
        when={!data().empty || data().totalMs > 0}
        fallback={
          <div style={{ color: 'var(--text-muted)', 'font-size': '11px', padding: '8px 0' }}>
            No timing data available for this request.
          </div>
        }
      >
        <Headline row={props.row} totalMs={data().totalMs} />

        <Show when={data().connectionStart.length > 0}>
          <PhaseGroup
            title="Connection Start"
            phases={data().connectionStart}
            totalMs={data().totalMs}
          />
        </Show>

        <Show when={data().requestResponse.length > 0}>
          <PhaseGroup
            title="Request/Response"
            phases={data().requestResponse}
            totalMs={data().totalMs}
          />
        </Show>

        <div
          style={{
            'border-top': '1px solid var(--border)',
            padding: '6px 0 2px',
            'margin-top': '8px',
            display: 'grid',
            'grid-template-columns': '160px 1fr 80px',
            gap: '8px',
            'font-weight': '600',
          }}
        >
          <span>Total</span>
          <span />
          <span style={{ 'text-align': 'right', 'font-variant-numeric': 'tabular-nums' }}>
            {formatMs(data().totalMs)}
          </span>
        </div>
      </Show>
    </div>
  )
}

const Headline: Component<{ row: HttpRow; totalMs: number }> = (props) => {
  const queuedAt = () => {
    if (props.row.startedAt === undefined) return ''
    return new Date(props.row.startedAt).toLocaleTimeString()
  }
  return (
    <div
      style={{
        'font-size': '11px',
        color: 'var(--text-secondary)',
        margin: '4px 0 10px',
      }}
    >
      Started at {queuedAt()} · request lifetime {formatMs(props.totalMs)}
    </div>
  )
}

const PhaseGroup: Component<{
  title: string
  phases: TimingPhase[]
  totalMs: number
}> = (props) => (
  <div style={{ 'margin-bottom': '10px' }}>
    <div
      style={{
        display: 'grid',
        'grid-template-columns': '160px 1fr 80px',
        gap: '8px',
        'font-weight': '600',
        'font-size': '10px',
        color: 'var(--text-secondary)',
        'text-transform': 'uppercase',
        'letter-spacing': '0.5px',
        'border-bottom': '1px solid var(--border)',
        'padding-bottom': '2px',
        'margin-bottom': '4px',
      }}
    >
      <span>{props.title}</span>
      <span />
      <span style={{ 'text-align': 'right' }}>Duration</span>
    </div>
    <For each={props.phases}>{(phase) => <PhaseRow phase={phase} totalMs={props.totalMs} />}</For>
  </div>
)

const PhaseRow: Component<{ phase: TimingPhase; totalMs: number }> = (props) => {
  const leftPct = () => (props.totalMs > 0 ? (props.phase.startMs / props.totalMs) * 100 : 0)
  const widthPct = () =>
    Math.max(
      0.5,
      props.totalMs > 0 ? ((props.phase.endMs - props.phase.startMs) / props.totalMs) * 100 : 0,
    )
  const duration = () => props.phase.endMs - props.phase.startMs
  return (
    <div
      style={{
        display: 'grid',
        'grid-template-columns': '160px 1fr 80px',
        gap: '8px',
        'align-items': 'center',
        margin: '3px 0',
        'font-size': '11px',
      }}
    >
      <span style={{ 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>
        {props.phase.name}
      </span>
      <div
        style={{
          position: 'relative',
          height: '14px',
          background: 'var(--bg-secondary)',
          'border-radius': '2px',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: `${leftPct()}%`,
            width: `${widthPct()}%`,
            top: '2px',
            bottom: '2px',
            background: props.phase.color,
            'border-radius': '2px',
            'min-width': '2px',
          }}
        />
      </div>
      <span style={{ 'text-align': 'right', 'font-variant-numeric': 'tabular-nums' }}>
        {formatMs(duration())}
      </span>
    </div>
  )
}
