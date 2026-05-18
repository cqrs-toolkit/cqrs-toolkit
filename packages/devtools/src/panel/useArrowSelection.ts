/**
 * Keyboard row navigation for tab list views.
 *
 * Intercepts ArrowUp / ArrowDown / PageUp / PageDown / Home / End on
 * document and moves the tab's selection through its current filtered list,
 * skipping items whose getId returns undefined (e.g. session-divider items
 * in Events / Sync). Does nothing when the user is typing in a control.
 *
 * The select callback receives both the new id and its index in the filtered
 * list so each tab can drive a scroll-into-view (DOM scrollIntoView for
 * non-virtual lists, VirtualScroller.ensureVisible for virtual ones).
 */

import { onCleanup, onMount } from 'solid-js'

export interface ArrowSelectionOptions<T> {
  items: () => readonly T[]
  selectedId: () => string | undefined
  getId: (item: T) => string | undefined
  /** Called with the selected id AND its index in the filtered list. */
  select: (id: string, index: number) => void
}

/** Rows traversed per PageUp / PageDown press. */
const PAGE_SIZE = 10

const HANDLED_KEYS: ReadonlySet<string> = new Set([
  'ArrowDown',
  'ArrowUp',
  'PageDown',
  'PageUp',
  'Home',
  'End',
])

export function useArrowSelection<T>(opts: ArrowSelectionOptions<T>): void {
  onMount(() => {
    function handler(e: KeyboardEvent): void {
      if (!HANDLED_KEYS.has(e.key)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return
        if (target.isContentEditable) return
      }

      const list = opts.items()
      if (list.length === 0) return

      const currentId = opts.selectedId()
      const currentIndex =
        currentId === undefined ? -1 : list.findIndex((item) => opts.getId(item) === currentId)

      let next: { id: string; index: number } | undefined
      switch (e.key) {
        case 'ArrowDown':
          next = stepToSelectable(list, currentIndex, 1, opts.getId)
          break
        case 'ArrowUp':
          next = stepToSelectable(list, currentIndex, -1, opts.getId)
          break
        case 'PageDown':
          next = pageToSelectable(list, currentIndex, PAGE_SIZE, opts.getId)
          break
        case 'PageUp':
          next = pageToSelectable(list, currentIndex, -PAGE_SIZE, opts.getId)
          break
        case 'Home':
          next = edgeToSelectable(list, 1, opts.getId)
          break
        case 'End':
          next = edgeToSelectable(list, -1, opts.getId)
          break
      }
      if (next === undefined) return

      e.preventDefault()
      opts.select(next.id, next.index)
    }
    document.addEventListener('keydown', handler)
    onCleanup(() => document.removeEventListener('keydown', handler))
  })
}

/**
 * Walk the list from `from + delta` in steps of `delta`, returning the first
 * item with a defined id (i.e. the next selectable one). Returns undefined if
 * nothing selectable is found in that direction.
 */
function stepToSelectable<T>(
  list: readonly T[],
  from: number,
  delta: number,
  getId: (item: T) => string | undefined,
): { id: string; index: number } | undefined {
  if (from === -1) return edgeToSelectable(list, delta, getId)
  for (let i = from + delta; i >= 0 && i < list.length; i += delta) {
    const item = list[i]
    if (item === undefined) continue
    const id = getId(item)
    if (id !== undefined) return { id, index: i }
  }
  return undefined
}

/**
 * Jump by `delta` positions from `from`. If the landing index isn't
 * selectable, search outward in the jump direction first, then fall back
 * toward `from` (without crossing it) until a selectable item is found.
 */
function pageToSelectable<T>(
  list: readonly T[],
  from: number,
  delta: number,
  getId: (item: T) => string | undefined,
): { id: string; index: number } | undefined {
  if (list.length === 0) return undefined
  const start = from === -1 ? (delta > 0 ? 0 : list.length - 1) : from
  let target = start + delta
  if (target < 0) target = 0
  if (target >= list.length) target = list.length - 1
  const dir = delta >= 0 ? 1 : -1
  for (let i = target; i >= 0 && i < list.length; i += dir) {
    const item = list[i]
    if (item === undefined) continue
    const id = getId(item)
    if (id !== undefined) return { id, index: i }
  }
  for (let i = target - dir; i >= 0 && i < list.length; i -= dir) {
    if (i === from) break
    const item = list[i]
    if (item === undefined) continue
    const id = getId(item)
    if (id !== undefined) return { id, index: i }
  }
  return undefined
}

/**
 * First selectable item from one end of the list. `direction > 0` walks from
 * the top down; `direction < 0` walks from the bottom up.
 */
function edgeToSelectable<T>(
  list: readonly T[],
  direction: number,
  getId: (item: T) => string | undefined,
): { id: string; index: number } | undefined {
  const start = direction > 0 ? 0 : list.length - 1
  const step = direction > 0 ? 1 : -1
  for (let i = start; i >= 0 && i < list.length; i += step) {
    const item = list[i]
    if (item === undefined) continue
    const id = getId(item)
    if (id !== undefined) return { id, index: i }
  }
  return undefined
}
