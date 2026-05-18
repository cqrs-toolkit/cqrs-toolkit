import { createEffect, createSignal, type Component } from 'solid-js'
import { AboutTab } from './components/about/AboutTab.js'
import { CacheTab } from './components/cache/CacheTab.js'
import { CommandsTab } from './components/commands/CommandsTab.js'
import { ConnectionBanner } from './components/ConnectionBanner.js'
import { EventBusTab } from './components/event-bus/EventBusTab.js'
import { EventsTab } from './components/events/EventsTab.js'
import { NetworkTab } from './components/network/NetworkTab.js'
import { ReadModelsTab } from './components/read-models/ReadModelsTab.js'
import { StorageTab } from './components/storage/StorageTab.js'
import { SyncTab } from './components/sync/SyncTab.js'
import { TabBar, type TabName } from './components/TabBar.js'
import { WriteQueueTab } from './components/write-queue/WriteQueueTab.js'
import { downloadJson } from './downloadJson.js'
import { createHarCapture } from './networkDevtools.js'
import { settings } from './storage/preferences.js'
import { createCacheStore } from './stores/cache.js'
import { createCommandsStore } from './stores/commands.js'
import { createConnectionStore } from './stores/connection.js'
import { createEventBusStore } from './stores/eventBus.js'
import { createEventsStore } from './stores/events.js'
import { createNetworkStore } from './stores/network.js'
import { createReadModelsStore } from './stores/readModels.js'
import { createStorageStore } from './stores/storage.js'
import { createSyncStore } from './stores/sync.js'
import { createWriteQueueStore } from './stores/writeQueue.js'

export const App: Component = () => {
  // settings.init() ran in the entry point, so reads are synchronous now.
  // Every settings key has a default; reads never return undefined.
  const [tabOrder, setTabOrder] = createSignal<readonly TabName[]>(settings.tabOrder)
  const [activeTab, setActiveTabSignal] = createSignal<TabName>(settings.activeTab)

  function setActiveTab(tab: TabName): void {
    setActiveTabSignal(tab)
    void settings.update({ activeTab: tab })
  }

  function handleReorder(next: TabName[]): void {
    setTabOrder(next)
    void settings.update({ tabOrder: next })
  }

  const commandsStore = createCommandsStore()
  const eventsStore = createEventsStore()
  const cacheStore = createCacheStore()
  const readModelsStore = createReadModelsStore()
  const syncStore = createSyncStore()
  const eventBusStore = createEventBusStore()
  const writeQueueStore = createWriteQueueStore()
  const storageStore = createStorageStore()
  const networkStore = createNetworkStore()
  const harCapture = createHarCapture((row) => networkStore.applyHttpRow(row))

  const [inspectedOrigin, setInspectedOrigin] = createSignal('')
  chrome.devtools.inspectedWindow.eval('location.origin', (result: unknown, exceptionInfo) => {
    if (!exceptionInfo && typeof result === 'string') setInspectedOrigin(result)
  })

  const [autoStartRequested] = createSignal(settings.captureOnStart)

  const connection = createConnectionStore({
    onEvent(event) {
      commandsStore.handleEvent(event)
      eventsStore.handleEvent(event)
      cacheStore.handleEvent(event)
      readModelsStore.handleEvent(event)
      syncStore.handleEvent(event)
      writeQueueStore.handleEvent(event)
      eventBusStore.handleEvent(event)
    },
    onCommandSnapshot(commands) {
      commandsStore.setCommands(commands)
    },
    onBufferDump(dump) {
      if (dump.commands.length > 0) {
        commandsStore.setCommands(dump.commands)
      }
      for (const event of dump.events) {
        commandsStore.handleEvent(event)
        eventsStore.handleEvent(event)
        cacheStore.handleEvent(event)
        readModelsStore.handleEvent(event)
        syncStore.handleEvent(event)
        writeQueueStore.handleEvent(event)
        eventBusStore.handleEvent(event)
      }
    },
    onNetEvent(event) {
      networkStore.applyEvent(event)
    },
    onNetState(state) {
      networkStore.applyState(state)
    },
  })

  function beginCapture(origin: string): void {
    connection.startNetCapture(origin, connection.mode())
    harCapture.start(origin)
  }

  function endCapture(): void {
    connection.stopNetCapture()
    harCapture.stop()
  }

  // Auto-start capture exactly once when (a) the user previously left capture
  // running, (b) the inspected origin has been resolved, (c) the panel↔bg
  // port is connected, and (d) the client has registered so we know its mode.
  // Without (d) the capture would fail with "Client mode unknown" while data
  // flows independently via HAR and the page hook — confusing mismatch.
  // Subsequent reconnects don't retrigger.
  let autoStartFired = false
  createEffect(() => {
    if (autoStartFired) return
    if (!autoStartRequested()) return
    const origin = inspectedOrigin()
    if (!origin) return
    if (connection.state() === 'disconnected') return
    if (!connection.mode()) return
    autoStartFired = true
    beginCapture(origin)
  })

  return (
    <div class={`panel ${detectTheme()}`}>
      <ConnectionBanner state={connection.state()} role={connection.role()} />
      <TabBar
        tabs={tabOrder()}
        active={activeTab()}
        onSelect={setActiveTab}
        onReorder={handleReorder}
      />
      <div class="tab-content">
        {activeTab() === 'Commands' ? (
          <CommandsTab
            store={commandsStore}
            onRetry={(id) => connection.sendAction('retry', id)}
            onCancel={(id) => connection.sendAction('cancel', id)}
            onExport={() => downloadJson(commandsStore.exportJson(), 'commands')}
            onClear={() => {
              connection.clearBuffer()
              commandsStore.clear()
            }}
          />
        ) : activeTab() === 'Events' ? (
          <EventsTab
            store={eventsStore}
            onExport={() => downloadJson(eventsStore.exportJson(), 'events')}
            onClear={() => {
              connection.clearBuffer()
              eventsStore.clear()
            }}
          />
        ) : activeTab() === 'Cache' ? (
          <CacheTab
            store={cacheStore}
            onExport={() => downloadJson(cacheStore.exportJson(), 'cache')}
            onClear={() => {
              connection.clearBuffer()
              cacheStore.clear()
            }}
          />
        ) : activeTab() === 'Read Models' ? (
          <ReadModelsTab
            store={readModelsStore}
            onExport={() => downloadJson(readModelsStore.exportJson(), 'read-models')}
            onClear={() => {
              connection.clearBuffer()
              readModelsStore.clear()
            }}
          />
        ) : activeTab() === 'Sync' ? (
          <SyncTab
            store={syncStore}
            onExport={() => downloadJson(syncStore.exportJson(), 'sync')}
            onClear={() => {
              connection.clearBuffer()
              syncStore.clear()
            }}
          />
        ) : activeTab() === 'Write Queue' ? (
          <WriteQueueTab
            store={writeQueueStore}
            onExport={() => downloadJson(writeQueueStore.exportJson(), 'write-queue')}
            onClear={() => {
              connection.clearBuffer()
              writeQueueStore.clear()
            }}
          />
        ) : activeTab() === 'EventBus' ? (
          <EventBusTab
            store={eventBusStore}
            onExport={() => downloadJson(eventBusStore.exportJson(), 'event-bus')}
            onClear={() => {
              connection.clearBuffer()
              eventBusStore.clear()
            }}
          />
        ) : activeTab() === 'Storage' ? (
          <StorageTab
            store={storageStore}
            exec={(sql, bind) => connection.execSql(sql, bind)}
            isDark={detectTheme() === 'theme-dark'}
          />
        ) : activeTab() === 'Network' ? (
          <NetworkTab
            store={networkStore}
            onStart={() => {
              beginCapture(inspectedOrigin())
              void settings.update({ captureOnStart: true })
            }}
            onStop={() => {
              endCapture()
              void settings.update({ captureOnStart: false })
            }}
            onExport={() => downloadJson(networkStore.exportJson(), 'network')}
            onClear={() => networkStore.clear()}
          />
        ) : activeTab() === 'About' ? (
          <AboutTab
            mode={connection.mode()}
            workerUrl={connection.workerUrl()}
            onReset={() => {
              // Wipe all preferences, then keep activeTab on this panel so
              // the user stays put across the reload below. Reload picks up
              // the new (mostly empty) state and refreshes any in-memory
              // mirrors of settings (tab order, network columns, panel widths).
              void settings.reset({ activeTab: 'About' }).then(() => {
                window.location.reload()
              })
            }}
          />
        ) : (
          <div class="placeholder">{activeTab()} tab — coming soon</div>
        )}
      </div>
    </div>
  )
}

function detectTheme(): string {
  if (typeof chrome !== 'undefined' && chrome.devtools?.panels?.themeName) {
    return chrome.devtools.panels.themeName === 'dark' ? 'theme-dark' : 'theme-light'
  }
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ) {
    return 'theme-dark'
  }
  return 'theme-light'
}
