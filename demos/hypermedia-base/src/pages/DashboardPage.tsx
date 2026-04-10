import { type CollectionSyncStatus, deriveScopeKey, type LibraryEvent } from '@cqrs-toolkit/client'
import { appCreateListQuery } from '@cqrs-toolkit/demo-base/common/components'
import type { Notebook } from '@cqrs-toolkit/demo-base/notebooks/domain'
import {
  NOTEBOOK_SEED_KEY,
  NOTEBOOKS_COLLECTION_NAME,
} from '@cqrs-toolkit/demo-base/notebooks/domain'
import type { Todo } from '@cqrs-toolkit/demo-base/todos/domain'
import { TODO_SEED_KEY, TODOS_COLLECTION_NAME } from '@cqrs-toolkit/demo-base/todos/domain'
import { ServiceLink } from '@meticoeus/ddd-es'
import { A } from '@solidjs/router'
import { filter } from 'rxjs'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { useClient } from '../bootstrap/typed-client.js'

type PanelState = 'loading' | 'ready' | 'error'

export default function DashboardPage() {
  const client = useClient()
  const todosQuery = appCreateListQuery<Todo>(
    client.queryManager,
    TODOS_COLLECTION_NAME,
    deriveScopeKey({ scopeType: 'todos' }),
  )
  const notebooksQuery = appCreateListQuery<Notebook>(
    client.queryManager,
    NOTEBOOKS_COLLECTION_NAME,
    NOTEBOOK_SEED_KEY,
  )
  const [todosState, setTodosState] = createSignal<PanelState>('loading')
  const [notebooksState, setNotebooksState] = createSignal<PanelState>('loading')
  const [todosSync, setTodosSync] = createSignal<CollectionSyncStatus>()
  const [notebooksSync, setNotebooksSync] = createSignal<CollectionSyncStatus>()

  function markReady(collection: string): void {
    if (collection === TODOS_COLLECTION_NAME) setTodosState('ready')
    if (collection === NOTEBOOKS_COLLECTION_NAME) setNotebooksState('ready')
  }

  function markError(collection: string): void {
    if (collection === TODOS_COLLECTION_NAME) setTodosState('error')
    if (collection === NOTEBOOKS_COLLECTION_NAME) setNotebooksState('error')
  }

  async function refreshSyncStatus(): Promise<void> {
    const [todosStatus, notebooksStatus] = await Promise.all([
      client.syncManager.getCollectionStatus(TODOS_COLLECTION_NAME, TODO_SEED_KEY),
      client.syncManager.getCollectionStatus(NOTEBOOKS_COLLECTION_NAME, NOTEBOOK_SEED_KEY),
    ])
    setTodosSync(todosStatus)
    setNotebooksSync(notebooksStatus)
  }

  function recentIncompleteTodos(): Todo[] {
    return todosQuery.items
      .filter((t) => t.status !== 'completed')
      .slice(-5)
      .reverse()
  }

  function recentNotebooks(): Notebook[] {
    return notebooksQuery.items.slice(-5).reverse()
  }

  function syncLabel(status: CollectionSyncStatus | undefined): string {
    if (!status) return '?'
    if (status.error) return 'error'
    if (status.syncing) return 'syncing'
    if (status.seeded) return 'seeded'
    return 'pending'
  }

  onMount(() => {
    refreshSyncStatus()

    // Subscribe to sync completion and failure to transition panels out of loading.
    const syncSub = client.events$
      .pipe(
        filter(
          (
            e,
          ): e is
            | LibraryEvent<ServiceLink, 'sync:completed'>
            | LibraryEvent<ServiceLink, 'sync:failed'> =>
            e.type === 'sync:completed' || e.type === 'sync:failed',
        ),
      )
      .subscribe((event) => {
        refreshSyncStatus()
        if (event.type === 'sync:completed') {
          markReady(event.data.collection)
        } else {
          markError(event.data.collection)
        }
      })

    // Handle the "already synced" case: if the collection was seeded before this
    // component mounted, mark ready immediately.
    // Skip only when seeded is explicitly false (sync registered but not yet complete).
    Promise.all([
      client.syncManager.getCollectionStatus(TODOS_COLLECTION_NAME, TODO_SEED_KEY),
      client.syncManager.getCollectionStatus(NOTEBOOKS_COLLECTION_NAME, NOTEBOOK_SEED_KEY),
    ]).then(([todosStatus, notebooksStatus]) => {
      if (todosStatus?.seeded !== false) setTodosState('ready')
      if (notebooksStatus?.seeded !== false) setNotebooksState('ready')
    })

    onCleanup(() => {
      syncSub.unsubscribe()
    })
  })

  return (
    <div class="max-w-4xl mx-auto px-4 py-8">
      <h1 class="text-2xl font-bold text-center mb-1">CQRS Client Demo</h1>
      <div class="text-center mb-8">
        <span class="mode-badge inline-block text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
          mode: {client.mode} | status: {client.status} | sync: todos=
          {syncLabel(todosSync())} notebooks={syncLabel(notebooksSync())}
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Todos panel */}
        <div
          class={`rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 dash-todos-${todosState()}`}
        >
          <A
            href="/todos"
            class="block text-center text-lg font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 mb-4"
          >
            Todos &rarr;
          </A>
          <Show
            when={todosState() === 'ready'}
            fallback={
              <p class="text-neutral-400 text-sm">
                {todosState() === 'error' ? 'Sync failed.' : 'Loading...'}
              </p>
            }
          >
            <Show
              when={recentIncompleteTodos().length > 0}
              fallback={
                <p class="dash-todo-empty text-neutral-400 text-sm">No incomplete todos.</p>
              }
            >
              <ul class="space-y-2 p-0">
                <For each={recentIncompleteTodos()}>
                  {(todo) => (
                    <li class="dash-todo-item flex items-center gap-2 text-sm">
                      <span
                        class={`inline-block w-2 h-2 rounded-full ${todo.status === 'in_progress' ? 'bg-amber-400' : 'bg-neutral-300'}`}
                      />
                      <span>{todo.content}</span>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </Show>
        </div>

        {/* Notebooks panel */}
        <div
          class={`rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 dash-notebooks-${notebooksState()}`}
        >
          <A
            href="/notes"
            class="block text-center text-lg font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 mb-4"
          >
            Notebooks &rarr;
          </A>
          <Show
            when={notebooksState() === 'ready'}
            fallback={
              <p class="text-neutral-400 text-sm">
                {notebooksState() === 'error' ? 'Sync failed.' : 'Loading...'}
              </p>
            }
          >
            <Show
              when={recentNotebooks().length > 0}
              fallback={
                <p class="dash-notebook-empty text-neutral-400 text-sm">No notebooks yet.</p>
              }
            >
              <ul class="space-y-2 p-0">
                <For each={recentNotebooks()}>
                  {(notebook) => (
                    <li class="dash-notebook-item text-sm">
                      <span class="dash-notebook-name font-medium truncate block">
                        {notebook.name}
                      </span>
                      <Show when={notebook.tags.length > 0}>
                        <div class="dash-notebook-tags flex flex-wrap gap-1 mt-0.5">
                          <For each={notebook.tags}>
                            {(tag) => (
                              <span class="dash-notebook-tag inline-block px-1.5 py-0.5 text-xs rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                                {tag}
                              </span>
                            )}
                          </For>
                        </div>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </Show>
        </div>
      </div>
      <div class="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700">
        <h2 class="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-3">
          Developer Tools
        </h2>
        <A
          href="/commands"
          class="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Command Queue Inspector &rarr;
        </A>
      </div>
    </div>
  )
}
