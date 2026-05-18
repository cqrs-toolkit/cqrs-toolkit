import { createSignal, For, Show, type Component } from 'solid-js'

export const DEFAULT_TABS = [
  'Network',
  'Commands',
  'Events',
  'Cache',
  'Read Models',
  'Sync',
  'Write Queue',
  'EventBus',
  'Storage',
  'About',
] as const

export type TabName = (typeof DEFAULT_TABS)[number]

interface DropTarget {
  index: number
  position: 'before' | 'after'
}

interface TabBarProps {
  tabs: readonly TabName[]
  active: TabName
  onSelect: (tab: TabName) => void
  onReorder: (next: TabName[]) => void
}

export const TabBar: Component<TabBarProps> = (props) => {
  const [dragSourceIndex, setDragSourceIndex] = createSignal<number | undefined>()
  const [dropTarget, setDropTarget] = createSignal<DropTarget | undefined>()

  function handleDragStart(e: DragEvent, index: number): void {
    if (!e.dataTransfer) return
    e.dataTransfer.effectAllowed = 'move'
    // Firefox requires data to be set for the drag to begin.
    e.dataTransfer.setData('text/plain', String(index))
    setDragSourceIndex(index)
  }

  function handleDragOver(e: DragEvent, index: number): void {
    if (dragSourceIndex() === undefined) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    const el = e.currentTarget
    if (!(el instanceof HTMLElement)) return
    const rect = el.getBoundingClientRect()
    const midpoint = rect.left + rect.width / 2
    setDropTarget({ index, position: e.clientX < midpoint ? 'before' : 'after' })
  }

  function handleDragLeave(): void {
    // Don't clear drop target on leave — dragover from the next sibling will
    // update it. Clearing here causes the indicator to flicker.
  }

  function handleDragEnd(): void {
    setDragSourceIndex(undefined)
    setDropTarget(undefined)
  }

  function handleDrop(e: DragEvent): void {
    e.preventDefault()
    const source = dragSourceIndex()
    const target = dropTarget()
    setDragSourceIndex(undefined)
    setDropTarget(undefined)
    if (source === undefined || target === undefined) return
    const desired = target.position === 'before' ? target.index : target.index + 1
    if (source === desired || source + 1 === desired) return
    const insertAt = source < desired ? desired - 1 : desired
    const next: TabName[] = [...props.tabs]
    const moved = next.splice(source, 1)[0]
    if (moved === undefined) return
    next.splice(insertAt, 0, moved)
    props.onReorder(next)
  }

  return (
    <div class="tab-bar" onDrop={handleDrop}>
      <For each={props.tabs}>
        {(tab, index) => (
          <span
            style={{ position: 'relative', display: 'inline-flex' }}
            onDragOver={(e) => handleDragOver(e, index())}
            onDragLeave={handleDragLeave}
          >
            <Show when={showIndicator(dropTarget(), index(), 'before')}>
              <DropIndicator side="left" />
            </Show>
            <button
              class={`tab-btn ${props.active === tab ? 'active' : ''}`}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, index())}
              onDragEnd={handleDragEnd}
              onClick={() => props.onSelect(tab)}
              style={{
                opacity: dragSourceIndex() === index() ? 0.4 : 1,
              }}
            >
              {tab}
            </button>
            <Show when={showIndicator(dropTarget(), index(), 'after')}>
              <DropIndicator side="right" />
            </Show>
          </span>
        )}
      </For>
    </div>
  )
}

function showIndicator(
  target: DropTarget | undefined,
  index: number,
  side: 'before' | 'after',
): boolean {
  if (!target || target.index !== index) return false
  return target.position === side
}

const DropIndicator: Component<{ side: 'left' | 'right' }> = (props) => (
  <span
    style={{
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: '2px',
      background: 'var(--status-sending)',
      'pointer-events': 'none',
      [props.side]: '-1px',
      'z-index': 1,
    }}
  />
)
