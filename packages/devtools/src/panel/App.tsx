import { createSignal, type Component } from 'solid-js'
import { CacheTab } from './components/cache/CacheTab.js'
import { CommandsTab } from './components/commands/CommandsTab.js'
import { ConnectionBanner } from './components/ConnectionBanner.js'
import { EventBusTab } from './components/event-bus/EventBusTab.js'
import { EventsTab } from './components/events/EventsTab.js'
import { ReadModelsTab } from './components/read-models/ReadModelsTab.js'
import { StorageTab } from './components/storage/StorageTab.js'
import { SyncTab } from './components/sync/SyncTab.js'
import { TabBar, type TabName } from './components/TabBar.js'
import { WriteQueueTab } from './components/write-queue/WriteQueueTab.js'
import { downloadJson } from './downloadJson.js'
import { createCacheStore } from './stores/cache.js'
import { createCommandsStore } from './stores/commands.js'
import { createConnectionStore } from './stores/connection.js'
import { createEventBusStore } from './stores/eventBus.js'
import { createEventsStore } from './stores/events.js'
import { createReadModelsStore } from './stores/readModels.js'
import { createStorageStore } from './stores/storage.js'
import { createSyncStore } from './stores/sync.js'
import { createWriteQueueStore } from './stores/writeQueue.js'

export const App: Component = () => {
  const [activeTab, setActiveTab] = createSignal<TabName>('Commands')

  const commandsStore = createCommandsStore()
  const eventsStore = createEventsStore()
  const cacheStore = createCacheStore()
  const readModelsStore = createReadModelsStore()
  const syncStore = createSyncStore()
  const eventBusStore = createEventBusStore()
  const writeQueueStore = createWriteQueueStore()
  const storageStore = createStorageStore()

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
  })

  return (
    <div class={`panel ${detectTheme()}`}>
      <ConnectionBanner state={connection.state()} role={connection.role()} />
      <TabBar active={activeTab()} onSelect={setActiveTab} />
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
