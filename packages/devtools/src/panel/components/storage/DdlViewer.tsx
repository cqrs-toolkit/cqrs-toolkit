import { sql } from '@codemirror/lang-sql'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import type { Component } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'

interface DdlViewerProps {
  ddl: string
  isDark: boolean
}

export const DdlViewer: Component<DdlViewerProps> = (props) => {
  let containerRef: HTMLDivElement | undefined
  let editorView: EditorView | undefined

  onMount(() => {
    if (!containerRef) return

    const extensions = [
      basicSetup,
      sql(),
      EditorState.readOnly.of(true),
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
      doc: props.ddl,
      extensions,
      parent: containerRef,
    })

    onCleanup(() => {
      editorView?.destroy()
    })
  })

  return <div class="storage-ddl-viewer" ref={containerRef} />
}
