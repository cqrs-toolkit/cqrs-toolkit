import type { CommandStatus } from '@cqrs-toolkit/client'
import { createSignal, For, onCleanup, onMount } from 'solid-js'

const ALL_STATUSES: CommandStatus[] = [
  'pending',
  'blocked',
  'sending',
  'succeeded',
  'failed',
  'cancelled',
]

const STATUS_COLORS: Record<CommandStatus, string> = {
  pending: 'bg-amber-400',
  blocked: 'bg-purple-400',
  sending: 'bg-blue-400',
  succeeded: 'bg-green-400',
  failed: 'bg-red-400',
  cancelled: 'bg-neutral-400',
}

interface StatusFilterProps {
  selected: Set<CommandStatus>
  onChange: (next: Set<CommandStatus>) => void
}

export default function StatusFilter(props: StatusFilterProps) {
  const [open, setOpen] = createSignal(false)
  let containerRef: HTMLDivElement | undefined

  function label(): string {
    const size = props.selected.size
    if (size === ALL_STATUSES.length) return 'All levels'
    if (size === 1) {
      const [first] = props.selected
      return first ?? 'All levels'
    }
    return `${size} selected`
  }

  function toggle(status: CommandStatus) {
    const next = new Set(props.selected)
    if (next.has(status)) {
      next.delete(status)
    } else {
      next.add(status)
    }
    props.onChange(next)
  }

  function handleClickOutside(e: MouseEvent) {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setOpen(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
  })

  onCleanup(() => {
    document.removeEventListener('mousedown', handleClickOutside)
    document.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <div ref={containerRef} class="relative">
      <button
        class="px-3 py-1.5 text-sm rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 cursor-pointer"
        onClick={() => setOpen(!open())}
      >
        {label()}
      </button>

      {open() && (
        <div class="absolute right-0 mt-1 w-44 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg z-10">
          <For each={ALL_STATUSES}>
            {(status) => (
              <label class="flex items-center gap-2 px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-700 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={props.selected.has(status)}
                  onChange={() => toggle(status)}
                  class="accent-indigo-600"
                />
                <span class={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
                <span>{status}</span>
              </label>
            )}
          </For>
        </div>
      )}
    </div>
  )
}
