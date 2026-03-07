import { sql, SQLite } from '@codemirror/lang-sql'
import { Compartment, Prec } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import type { Component } from 'solid-js'
import { createEffect, For, onCleanup, onMount, Show } from 'solid-js'
import type { QueryLogEntry } from '../../stores/storage.js'

interface QueryWriterProps {
  initialText: string
  onTextChange: (text: string) => void
  onExecute: (sql: string) => void
  isDark: boolean
  schema: Record<string, string[]>
  logs: QueryLogEntry[]
  logsOpen: boolean
  onCloseLogs: () => void
  onClearLogs: () => void
  onToggleLogs: () => void
}

function formatLogTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}

export const QueryWriter: Component<QueryWriterProps> = (props) => {
  let containerRef: HTMLDivElement | undefined
  let editorView: EditorView | undefined
  const sqlCompartment = new Compartment()

  onMount(() => {
    if (!containerRef) return

    const extensions = [
      basicSetup,
      sqlCompartment.of(sql({ dialect: SQLite, schema: props.schema })),
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run() {
              if (editorView) {
                props.onExecute(editorView.state.doc.toString())
              }
              return true
            },
          },
        ]),
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          props.onTextChange(update.state.doc.toString())
        }
      }),
      EditorView.theme({
        '&': { fontSize: '11px', height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', monospace" },
      }),
    ]

    if (props.isDark) {
      extensions.push(oneDark)
    }

    editorView = new EditorView({
      doc: props.initialText,
      extensions,
      parent: containerRef,
    })

    onCleanup(() => {
      editorView?.destroy()
    })
  })

  createEffect(() => {
    const schema = props.schema
    if (editorView) {
      editorView.dispatch({
        effects: sqlCompartment.reconfigure(sql({ dialect: SQLite, schema })),
      })
    }
  })

  return (
    <div class="storage-query-writer">
      <div class="storage-query-actions">
        <button
          class="storage-execute-btn"
          title="Execute (Ctrl+Enter)"
          onClick={() => {
            if (editorView) {
              props.onExecute(editorView.state.doc.toString())
            }
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M3 1.5 L12 7 L3 12.5 Z" fill="#16a34a" />
          </svg>
        </button>
        <button
          class="storage-logs-toggle"
          classList={{ active: props.logsOpen }}
          title="Toggle Logs"
          onClick={() => props.onToggleLogs()}
        >
          Logs
        </button>
      </div>
      <div
        class="storage-query-editor"
        ref={containerRef}
        style={props.logsOpen ? { flex: '1' } : undefined}
      />
      <Show when={props.logsOpen}>
        <div class="storage-logs-panel">
          <div class="storage-logs-header">
            <span class="storage-logs-title">Logs</span>
            <div class="storage-logs-actions">
              <button class="detail-close-btn" onClick={() => props.onClearLogs()} title="Clear">
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <path
                    d="M3 3.5h8M5.5 3.5V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4 5v5.5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5"
                    stroke="currentColor"
                    stroke-width="1.2"
                    fill="none"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <button class="detail-close-btn" onClick={() => props.onCloseLogs()} title="Close">
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <path
                    d="M4 4 L10 10 M10 4 L4 10"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div class="storage-logs-content">
            <Show when={props.logs.length > 0} fallback={<div class="empty-state">No logs</div>}>
              <For each={props.logs}>
                {(entry) => (
                  <div class={`storage-log-entry storage-log-${entry.level}`}>
                    <span class="storage-log-time">{formatLogTime(entry.timestamp)}</span>
                    <span class="storage-log-message">{entry.message}</span>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
