import type { Component, JSX } from 'solid-js'
import { For, Show, createSignal, onCleanup } from 'solid-js'

interface ChipSelectProps {
  class?: string
  label: string
  values: string[]
  selected: Set<string>
  onToggle: (value: string) => void
  onSelectAll: () => void
  onClear: () => void
  colorVar: string
}

export const ChipSelect: Component<ChipSelectProps> = (props) => {
  const [open, setOpen] = createSignal(false)
  let containerRef: HTMLDivElement | undefined

  function handleClickOutside(e: MouseEvent): void {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setOpen(false)
    }
  }

  function toggle(): void {
    const next = !open()
    setOpen(next)
    if (next) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }

  onCleanup(() => {
    document.removeEventListener('mousedown', handleClickOutside)
  })

  function chipStyle(value: string): JSX.CSSProperties {
    const key = value.toLowerCase()
    const color = `var(--${props.colorVar}-${key})`
    const bg = `var(--${props.colorVar}-${key}-bg)`
    const active = props.selected.has(value)

    return {
      background: active ? bg : 'transparent',
      color,
      'border-color': color,
    }
  }

  return (
    <div class={`multi-select ${props.class ?? ''}`} ref={containerRef}>
      <button class="multi-select-btn" disabled={props.values.length === 0} onClick={toggle}>
        {props.label}
        <span class="multi-select-count">
          {props.selected.size}/{props.values.length}
        </span>
      </button>
      <Show when={open()}>
        <div class="multi-select-dropdown">
          <div class="multi-select-actions">
            <button class="multi-select-action" onClick={() => props.onSelectAll()}>
              All
            </button>
            <button class="multi-select-action" onClick={() => props.onClear()}>
              None
            </button>
          </div>
          <div class="chip-select-chips">
            <For each={props.values}>
              {(value) => (
                <button
                  class="filter-chip"
                  style={chipStyle(value)}
                  onClick={() => props.onToggle(value)}
                >
                  {value}
                </button>
              )}
            </For>
          </div>
          <div class="multi-select-footer">
            <button class="multi-select-close" onClick={() => setOpen(false)}>
              OK
            </button>
          </div>
        </div>
      </Show>
    </div>
  )
}
