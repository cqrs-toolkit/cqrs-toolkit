import type { Component } from 'solid-js'
import { createMemo, Match, onMount, Show, Switch } from 'solid-js'
import type { StorageStore } from '../../stores/storage.js'
import { DdlViewer } from './DdlViewer.js'
import { QueryWriter } from './QueryWriter.js'
import { ResultPanel } from './ResultPanel.js'
import { StorageTabBar } from './StorageTabBar.js'
import { TableTree } from './TableTree.js'

type ExecFn = (sql: string, bind?: unknown[]) => Promise<Record<string, unknown>[]>

interface StorageTabProps {
  store: StorageStore
  exec: ExecFn
  isDark: boolean
}

export const StorageTab: Component<StorageTabProps> = (props) => {
  onMount(() => {
    props.store.loadTables(props.exec)
  })

  const tabBarItems = createMemo(() =>
    props.store.tabs().map((tab) => ({
      id: tab.id,
      label: tab.type === 'ddl' ? `DDL: ${tab.table}` : tab.label,
      closeable: tab.id !== 'query',
    })),
  )

  const activeTab = createMemo(() =>
    props.store.tabs().find((t) => t.id === props.store.activeTabId()),
  )

  return (
    <Show when={!props.store.unavailable()} fallback={<UnavailableBanner />}>
      <div class="storage-container">
        <TableTree
          store={props.store}
          onOpenTable={(table) => props.store.openTableTab(table, props.exec)}
          onOpenDdl={(table) => props.store.openDdlTab(table)}
        />
        <div class="storage-panel">
          <StorageTabBar
            tabs={tabBarItems()}
            activeTabId={props.store.activeTabId()}
            onSelect={(id) => props.store.setActiveTab(id)}
            onClose={(id) => props.store.closeTab(id)}
          />
          <div class="storage-panel-content">
            <Switch>
              <Match when={activeTab()?.type === 'query'}>
                <QueryWriter
                  initialText={props.store.queryText()}
                  onTextChange={(text) => props.store.setQueryText(text)}
                  onExecute={(sql) => props.store.executeQuery(sql, props.exec)}
                  isDark={props.isDark}
                  schema={props.store.schema()}
                  logs={props.store.queryLogs()}
                  logsOpen={props.store.logsOpen()}
                  onCloseLogs={() => props.store.closeLogsPanel()}
                  onClearLogs={() => props.store.clearQueryLogs()}
                  onToggleLogs={() => props.store.toggleLogsPanel()}
                />
              </Match>
              <Match when={activeTab()?.type === 'result'}>
                {(() => {
                  const data = () => props.store.getResultData(props.store.activeTabId())
                  return (
                    <Show when={data()}>
                      {(d) => (
                        <ResultPanel
                          data={d()}
                          onFilterChange={(text) =>
                            props.store.setFilter(props.store.activeTabId(), text)
                          }
                          onNextPage={() =>
                            props.store.nextPage(props.store.activeTabId(), props.exec)
                          }
                          onPrevPage={() =>
                            props.store.prevPage(props.store.activeTabId(), props.exec)
                          }
                        />
                      )}
                    </Show>
                  )
                })()}
              </Match>
              <Match when={activeTab()?.type === 'ddl'}>
                {(() => {
                  const ddlTab = () => {
                    const tab = activeTab()
                    return tab?.type === 'ddl' ? tab : undefined
                  }
                  return (
                    <Show when={ddlTab()}>
                      {(tab) => <DdlViewer ddl={tab().ddl} isDark={props.isDark} />}
                    </Show>
                  )
                })()}
              </Match>
            </Switch>
          </div>
        </div>
      </div>
    </Show>
  )
}

const UnavailableBanner: Component = () => (
  <div class="storage-unavailable">
    Storage Explorer is not available in online-only mode. SQLite storage is only used in
    dedicated-worker and shared-worker modes.
  </div>
)
