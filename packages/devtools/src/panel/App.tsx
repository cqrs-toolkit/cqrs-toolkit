import { createSignal, type Component } from 'solid-js'
import { CacheTab } from './components/cache/CacheTab.js'
import { CommandsTab } from './components/commands/CommandsTab.js'
import { ConnectionBanner } from './components/ConnectionBanner.js'
import { EventsTab } from './components/events/EventsTab.js'
import { ReadModelsTab } from './components/read-models/ReadModelsTab.js'
import { SyncTab } from './components/sync/SyncTab.js'
import { TabBar, type TabName } from './components/TabBar.js'
import { createCacheStore } from './stores/cache.js'
import { createCommandsStore } from './stores/commands.js'
import { createConnectionStore } from './stores/connection.js'
import { createEventsStore } from './stores/events.js'
import { createReadModelsStore } from './stores/readModels.js'
import { createSyncStore } from './stores/sync.js'

export const App: Component = () => {
  const [activeTab, setActiveTab] = createSignal<TabName>('Commands')

  const commandsStore = createCommandsStore()
  const eventsStore = createEventsStore()
  const cacheStore = createCacheStore()
  const readModelsStore = createReadModelsStore()
  const syncStore = createSyncStore()

  const connection = createConnectionStore({
    onEvent(event) {
      commandsStore.handleEvent(event)
      eventsStore.handleEvent(event)
      cacheStore.handleEvent(event)
      readModelsStore.handleEvent(event)
      syncStore.handleEvent(event)
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
            onRefresh={() => connection.requestCommandSnapshot()}
            onClear={() => {
              connection.clearBuffer()
              commandsStore.clear()
            }}
          />
        ) : activeTab() === 'Events' ? (
          <EventsTab
            store={eventsStore}
            onClear={() => {
              connection.clearBuffer()
              eventsStore.clear()
            }}
          />
        ) : activeTab() === 'Cache' ? (
          <CacheTab
            store={cacheStore}
            onClear={() => {
              connection.clearBuffer()
              cacheStore.clear()
            }}
          />
        ) : activeTab() === 'Read Models' ? (
          <ReadModelsTab
            store={readModelsStore}
            onClear={() => {
              connection.clearBuffer()
              readModelsStore.clear()
            }}
          />
        ) : activeTab() === 'Sync' ? (
          <SyncTab
            store={syncStore}
            onClear={() => {
              connection.clearBuffer()
              syncStore.clear()
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
