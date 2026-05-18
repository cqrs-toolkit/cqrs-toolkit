import { Show, type Component } from 'solid-js'
import type { ClientMode } from '../../../shared/protocol.js'

interface AboutTabProps {
  mode: ClientMode | undefined
  workerUrl: string | undefined
  onReset: () => void
}

const MODE_LABEL: Record<ClientMode, string> = {
  'online-only': 'Online-only (page only, no worker)',
  'dedicated-worker': 'Dedicated worker (single-tab)',
  'shared-worker': 'Shared worker (multi-tab, OPFS-backed)',
}

/**
 * About tab.
 *
 * Surfaces metadata about the inspected CQRS client (the mode the client
 * actually settled on, the worker URL it launched) and offers a destructive
 * "Reset all settings" action that wipes panel preferences back to defaults.
 * Future home for project links and version info.
 */
export const AboutTab: Component<AboutTabProps> = (props) => {
  function handleReset(): void {
    const confirmed = window.confirm(
      'Reset all DevTools panel settings to defaults?\n\n' +
        'This wipes column visibility, panel widths, tab order, capture-on-start, ' +
        'and any other preferences. The page being inspected is not affected.',
    )
    if (!confirmed) return
    props.onReset()
  }

  const modeLabel = (): string =>
    props.mode === undefined ? 'Unknown — waiting for client to register' : MODE_LABEL[props.mode]

  return (
    <div
      style={{
        padding: '16px 20px',
        overflow: 'auto',
        height: '100%',
        'font-size': '13px',
        'line-height': '1.5',
      }}
    >
      <h2 style={{ margin: '0 0 4px 0', 'font-size': '14px', 'font-weight': '600' }}>
        CQRS Toolkit DevTools
      </h2>
      <div style={{ color: 'var(--text-muted)', 'margin-bottom': '20px' }}>
        Chrome extension panel for inspecting `@cqrs-toolkit/client` apps.
      </div>

      <section style={{ 'margin-bottom': '24px' }}>
        <h3
          style={{
            margin: '0 0 8px 0',
            'font-size': '12px',
            'font-weight': '600',
            'text-transform': 'uppercase',
            'letter-spacing': '0.5px',
            color: 'var(--text-muted)',
          }}
        >
          Client
        </h3>
        <Row label="Mode" value={modeLabel()} />
        <Show
          when={props.mode !== 'online-only' && props.workerUrl}
          fallback={
            <Show when={props.mode !== 'online-only'}>
              <Row label="Worker URL" value="(not configured)" muted />
            </Show>
          }
        >
          <Row label="Worker URL" value={props.workerUrl ?? ''} mono />
        </Show>
      </section>

      <section>
        <h3
          style={{
            margin: '0 0 8px 0',
            'font-size': '12px',
            'font-weight': '600',
            'text-transform': 'uppercase',
            'letter-spacing': '0.5px',
            color: 'var(--text-muted)',
          }}
        >
          Settings
        </h3>
        <div style={{ 'margin-bottom': '8px' }}>
          Reset all panel preferences to defaults. Stored under{' '}
          <code style={{ 'font-size': '11px' }}>chrome.storage.local.panelSettings</code> per
          extension install.
        </div>
        <button
          class="toolbar-btn"
          onClick={handleReset}
          style={{
            padding: '6px 14px',
            'background-color': 'var(--status-failed, #d33)',
            color: '#fff',
            border: 'none',
            'border-radius': '3px',
            cursor: 'pointer',
            'font-size': '12px',
          }}
        >
          Reset all settings
        </button>
      </section>
    </div>
  )
}

const Row: Component<{ label: string; value: string; mono?: boolean; muted?: boolean }> = (
  props,
) => (
  <div
    style={{
      display: 'grid',
      'grid-template-columns': '120px 1fr',
      gap: '12px',
      'padding-block': '4px',
    }}
  >
    <div style={{ color: 'var(--text-muted)' }}>{props.label}</div>
    <div
      style={{
        'font-family': props.mono ? 'var(--font-mono, monospace)' : 'inherit',
        'word-break': 'break-all',
        color: props.muted ? 'var(--text-muted)' : 'inherit',
      }}
    >
      {props.value}
    </div>
  </div>
)
