import { createSignal, type Component } from 'solid-js'
import { CommandsTab } from './components/CommandsTab.js'
import { ConnectionBanner } from './components/ConnectionBanner.js'
import { TabBar, type TabName } from './components/TabBar.js'
import { createCommandsStore } from './stores/commands.js'
import { createConnectionStore } from './stores/connection.js'

export const App: Component = () => {
  const [activeTab, setActiveTab] = createSignal<TabName>('Commands')

  const commandsStore = createCommandsStore()

  const connection = createConnectionStore({
    onEvent(event) {
      commandsStore.handleEvent(event)
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
