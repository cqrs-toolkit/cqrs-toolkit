import { Show, type Component, type JSX } from 'solid-js'

interface FilterInputProps {
  placeholder: string
  value: string
  onInput: (next: string) => void
  /** Extra class merged onto the inner <input>. Tab-specific styling hook. */
  class?: string
  /** Container style overrides (e.g. width). */
  style?: JSX.CSSProperties
}

/**
 * Toolbar text filter input with a dynamic clear button at its trailing edge.
 * The × appears when the value is non-empty and clears via `onInput('')`.
 * The input always reserves right padding for the button so width doesn't
 * shift when typing the first character.
 */
export const FilterInput: Component<FilterInputProps> = (props) => (
  <span class="toolbar-filter-input" style={props.style}>
    <input
      class={`toolbar-input ${props.class ?? ''}`}
      type="text"
      placeholder={props.placeholder}
      value={props.value}
      onInput={(e) => props.onInput(e.currentTarget.value)}
    />
    <Show when={props.value.length > 0}>
      <button
        class="toolbar-input-clear"
        title="Clear filter"
        aria-label="Clear filter"
        onClick={() => props.onInput('')}
        type="button"
      >
        ×
      </button>
    </Show>
  </span>
)
