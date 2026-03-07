/**
 * Virtual scroller for append-only, fixed-height-row lists.
 *
 * Renders only visible rows plus overscan, positioning them absolutely
 * within a spacer div sized to the full list height.
 */

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount } from 'solid-js'

const ROW_HEIGHT = 22

interface VirtualScrollerProps<T> {
  items: () => T[]
  rowHeight?: number
  renderRow: (item: T, index: number) => JSX.Element
  filterVersion: () => number
  overscan?: number
  class?: string
}

export function VirtualScroller<T>(props: VirtualScrollerProps<T>): JSX.Element {
  const rowHeight = props.rowHeight ?? ROW_HEIGHT
  const overscan = props.overscan ?? 5

  let outerRef: HTMLDivElement | undefined

  const [scrollTop, setScrollTop] = createSignal(0)
  const [viewportHeight, setViewportHeight] = createSignal(0)
  const [userAtBottom, setUserAtBottom] = createSignal(true)

  function handleScroll(): void {
    if (!outerRef) return
    setScrollTop(outerRef.scrollTop)
    setViewportHeight(outerRef.clientHeight)

    const distanceFromBottom = outerRef.scrollHeight - outerRef.scrollTop - outerRef.clientHeight
    setUserAtBottom(distanceFromBottom < rowHeight * 3)
  }

  onMount(() => {
    if (outerRef) {
      setViewportHeight(outerRef.clientHeight)

      const observer = new ResizeObserver(() => {
        if (outerRef) {
          setViewportHeight(outerRef.clientHeight)
        }
      })
      observer.observe(outerRef)
      onCleanup(() => observer.disconnect())
    }
  })

  const totalHeight = createMemo(() => props.items().length * rowHeight)

  const visibleRange = createMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop() / rowHeight) - overscan)
    const visibleCount = Math.ceil(viewportHeight() / rowHeight)
    const end = Math.min(props.items().length, start + visibleCount + overscan * 2)
    return { start, end }
  })

  const visibleItems = createMemo(() => {
    const { start, end } = visibleRange()
    const items = props.items()
    const result: { item: T; index: number }[] = []
    for (let i = start; i < end; i++) {
      const item = items[i]
      if (item) {
        result.push({ item, index: i })
      }
    }
    return result
  })

  function scrollToBottom(): void {
    if (outerRef) {
      outerRef.scrollTop = outerRef.scrollHeight
    }
  }

  // Auto-scroll when new items arrive and user is at bottom
  createEffect(
    on(
      () => props.items().length,
      () => {
        if (userAtBottom()) {
          queueMicrotask(scrollToBottom)
        }
      },
    ),
  )

  // Filter version change: unconditionally scroll to bottom
  createEffect(
    on(
      () => props.filterVersion(),
      () => {
        setUserAtBottom(true)
        queueMicrotask(scrollToBottom)
      },
      { defer: true },
    ),
  )

  return (
    <div ref={outerRef} class={`virtual-scroller ${props.class ?? ''}`} onScroll={handleScroll}>
      <div style={{ height: `${totalHeight()}px`, position: 'relative' }}>
        <For each={visibleItems()}>
          {(entry) => (
            <div
              style={{
                position: 'absolute',
                top: `${entry.index * rowHeight}px`,
                left: '0',
                right: '0',
                height: `${rowHeight}px`,
              }}
            >
              {props.renderRow(entry.item, entry.index)}
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
