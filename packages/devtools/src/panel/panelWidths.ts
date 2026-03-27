import { createSignal } from 'solid-js'

// Minimum width the detail panel can be resized to
export const MIN_DETAIL_WIDTH = 200

type TabId = 'commands' | 'events' | 'cache' | 'readModels' | 'sync' | 'eventBus' | 'storage'

// Minimum list widths derived from each tab's grid column minimums + 5 × 12px column-gap
// Commands: 65 + 70 + 120 + 90 + 45 + 75 + 60 = 525
// Events: 70 + 150 + 80 + 45 + 45 + 30 + 60 = 480
const MIN_LIST_WIDTHS: Record<TabId, number> = {
  commands: 525,
  events: 480,
  cache: 410,
  readModels: 370,
  sync: 420,
  eventBus: 416,
  storage: 300,
}

// Initial widths match current fixed CSS widths
const DEFAULTS: Record<TabId, number> = {
  commands: 360,
  events: 360,
  cache: 340,
  readModels: 360,
  sync: 320,
  eventBus: 340,
  storage: 400,
}

const signals: Record<TabId, ReturnType<typeof createSignal<number>>> = {
  commands: createSignal(DEFAULTS.commands),
  events: createSignal(DEFAULTS.events),
  cache: createSignal(DEFAULTS.cache),
  readModels: createSignal(DEFAULTS.readModels),
  sync: createSignal(DEFAULTS.sync),
  eventBus: createSignal(DEFAULTS.eventBus),
  storage: createSignal(DEFAULTS.storage),
}

export function getMinListWidth(tab: TabId): number {
  return MIN_LIST_WIDTHS[tab]
}

export function getPanelWidth(tab: TabId, containerWidth: number): number {
  const [stored] = signals[tab]
  if (containerWidth === 0) {
    return stored()
  }
  return Math.min(stored(), containerWidth - MIN_LIST_WIDTHS[tab])
}

export function setPanelWidth(tab: TabId, width: number, containerWidth: number): void {
  const maxWidth = containerWidth - MIN_LIST_WIDTHS[tab]
  const clamped = Math.max(MIN_DETAIL_WIDTH, Math.min(width, maxWidth))
  const [, setStored] = signals[tab]
  setStored(clamped)
}
