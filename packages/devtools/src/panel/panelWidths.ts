import { createSignal } from 'solid-js'
import { PANEL_TAB_IDS, settings, type PanelTabId } from './storage/preferences.js'

// Minimum width the detail panel can be resized to.
export const MIN_DETAIL_WIDTH = 200

export type TabId = PanelTabId

// Minimum list widths derived from each tab's grid column minimums + 5 × 12px column-gap.
// Commands: 65 + 70 + 120 + 90 + 45 + 75 + 60 = 525
// Events:   70 + 150 + 80 + 45 + 45 + 30 + 60 = 480
// Network:  180 + 64 + 62 + 70 + 90 + 70 + 78 + 120 = 734
const MIN_LIST_WIDTHS: Record<TabId, number> = {
  commands: 525,
  events: 480,
  cache: 410,
  readModels: 370,
  sync: 420,
  writeQueue: 400,
  eventBus: 416,
  storage: 300,
  network: 734,
}

// Initial widths used when no stored value exists for a given tab.
const DEFAULTS: Record<TabId, number> = {
  commands: 360,
  events: 360,
  cache: 340,
  readModels: 360,
  sync: 320,
  writeQueue: 340,
  eventBus: 340,
  storage: 400,
  network: 420,
}

function initialFromSettings(): Record<TabId, ReturnType<typeof createSignal<number>>> {
  const stored = settings.panelWidths
  const signals = {} as Record<TabId, ReturnType<typeof createSignal<number>>>
  for (const tab of PANEL_TAB_IDS) {
    signals[tab] = createSignal(stored[tab] ?? DEFAULTS[tab])
  }
  return signals
}

const signalRegistry = initialFromSettings()

// Persist debounced — drag generates many setPanelWidth calls per second; we
// don't need to write to storage on every frame.
let persistTimer: ReturnType<typeof setTimeout> | undefined
function schedulePersist(): void {
  if (persistTimer !== undefined) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = undefined
    const snapshot: Partial<Record<TabId, number>> = {}
    for (const tab of PANEL_TAB_IDS) {
      const [stored] = signalRegistry[tab]
      snapshot[tab] = stored()
    }
    void settings.update({ panelWidths: snapshot })
  }, 250)
}

export function getMinListWidth(tab: TabId): number {
  return MIN_LIST_WIDTHS[tab]
}

export function getPanelWidth(tab: TabId, containerWidth: number): number {
  const [stored] = signalRegistry[tab]
  if (containerWidth === 0) {
    return stored()
  }
  return Math.min(stored(), containerWidth - MIN_LIST_WIDTHS[tab])
}

export function setPanelWidth(tab: TabId, width: number, containerWidth: number): void {
  const maxWidth = containerWidth - MIN_LIST_WIDTHS[tab]
  const clamped = Math.max(MIN_DETAIL_WIDTH, Math.min(width, maxWidth))
  const [, setStored] = signalRegistry[tab]
  setStored(clamped)
  schedulePersist()
}
