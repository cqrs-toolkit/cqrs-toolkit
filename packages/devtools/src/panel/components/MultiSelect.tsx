import type { Component } from 'solid-js'
import { For, Show, createMemo, createSignal, onCleanup } from 'solid-js'

const FILTER_THRESHOLD = 10

interface MultiSelectProps {
  class?: string
  label: string
  values: string[]
  selected: Set<string>
  onToggle: (value: string) => void
  onSelectAll: () => void
  onClear: () => void
  formatValue?: (value: string) => string
}

export const MultiSelect: Component<MultiSelectProps> = (props) => {
  const [open, setOpen] = createSignal(false)
  const [filterText, setFilterText] = createSignal('')
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
      setFilterText('')
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }

  onCleanup(() => {
    document.removeEventListener('mousedown', handleClickOutside)
  })

  const format = (v: string) => props.formatValue?.(v) ?? v

  const showFilter = () => props.values.length > FILTER_THRESHOLD

  const visibleValues = createMemo(() => {
    const ft = filterText().toLowerCase()
    if (!ft) return props.values
    return props.values.filter((v) => format(v).toLowerCase().includes(ft))
  })

  return (
    <div class={`multi-select ${props.class ?? ''}`} ref={containerRef}>
      <button class="multi-select-btn" disabled={props.values.length === 0} onClick={toggle}>
        {props.label}
        <Show when={props.values.length > 0}>
          <span class="multi-select-count">
            {props.selected.size}/{props.values.length}
          </span>
        </Show>
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
          <Show when={showFilter()}>
            <div class="multi-select-filter">
              <input
                class="multi-select-filter-input"
                type="text"
                placeholder="Filter..."
                value={filterText()}
                onInput={(e) => setFilterText(e.currentTarget.value)}
              />
              <Show when={filterText()}>
                <button class="multi-select-filter-clear" onClick={() => setFilterText('')}>
                  ×
                </button>
              </Show>
            </div>
          </Show>
          <div class="multi-select-list">
            <For each={visibleValues()}>
              {(value) => (
                <label class="multi-select-item">
                  <input
                    type="checkbox"
                    checked={props.selected.has(value)}
                    onChange={() => props.onToggle(value)}
                  />
                  <span class="multi-select-label">{format(value)}</span>
                </label>
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
