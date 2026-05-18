import { For, onCleanup, onMount, Show, type Component } from 'solid-js'

export interface MenuItem {
  /** Visible label. Ignored when kind === 'separator'. */
  label?: string
  kind?: 'item' | 'separator'
  disabled?: boolean
  action?: () => void
}

export interface ContextMenuState {
  x: number
  y: number
  items: MenuItem[]
}

interface ContextMenuProps {
  state: ContextMenuState | undefined
  onClose: () => void
}

export const ContextMenu: Component<ContextMenuProps> = (props) => {
  function handleKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') props.onClose()
  }
  onMount(() => document.addEventListener('keydown', handleKey))
  onCleanup(() => document.removeEventListener('keydown', handleKey))

  return (
    <Show when={props.state}>
      {(state) => (
        <>
          <div
            onClick={() => props.onClose()}
            onContextMenu={(e) => {
              e.preventDefault()
              props.onClose()
            }}
            style={{
              position: 'fixed',
              inset: 0,
              'z-index': 1000,
            }}
          />
          <div
            style={{
              position: 'fixed',
              left: `${state().x}px`,
              top: `${state().y}px`,
              'z-index': 1001,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-strong)',
              'box-shadow': '0 4px 16px rgba(0, 0, 0, 0.3)',
              'min-width': '220px',
              padding: '4px 0',
              'font-size': '12px',
              'border-radius': '4px',
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <For each={state().items}>
              {(item) => (
                <Show
                  when={(item.kind ?? 'item') === 'item'}
                  fallback={
                    <div
                      style={{
                        height: '1px',
                        background: 'var(--border)',
                        margin: '4px 0',
                      }}
                    />
                  }
                >
                  <MenuRow
                    item={item}
                    onActivate={() => {
                      if (!item.disabled) {
                        item.action?.()
                        props.onClose()
                      }
                    }}
                  />
                </Show>
              )}
            </For>
          </div>
        </>
      )}
    </Show>
  )
}

const MenuRow: Component<{ item: MenuItem; onActivate: () => void }> = (props) => {
  let ref: HTMLDivElement | undefined
  return (
    <div
      ref={ref}
      onClick={() => props.onActivate()}
      onMouseEnter={() => {
        if (ref && !props.item.disabled) ref.style.background = 'var(--bg-hover)'
      }}
      onMouseLeave={() => {
        if (ref) ref.style.background = 'transparent'
      }}
      style={{
        padding: '4px 14px',
        cursor: props.item.disabled ? 'not-allowed' : 'pointer',
        opacity: props.item.disabled ? 0.4 : 1,
        'white-space': 'nowrap',
      }}
    >
      {props.item.label ?? ''}
    </div>
  )
}
