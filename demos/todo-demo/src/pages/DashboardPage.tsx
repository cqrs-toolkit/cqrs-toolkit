import { type CollectionSyncStatus, type LibraryEvent } from '@cqrs-toolkit/client'
import { A } from '@solidjs/router'
import { filter } from 'rxjs'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { Note } from '../../shared/notes/types'
import type { Todo } from '../../shared/todos/types'
import { useClient } from '../bootstrap/cqrs-context'

type PanelState = 'loading' | 'ready' | 'error'

export default function DashboardPage() {
  const client = useClient()
  const [todos, setTodos] = createSignal<Todo[]>([])
  const [notes, setNotes] = createSignal<Note[]>([])
  const [todosState, setTodosState] = createSignal<PanelState>('loading')
  const [notesState, setNotesState] = createSignal<PanelState>('loading')
  const [todosSync, setTodosSync] = createSignal<CollectionSyncStatus>()
  const [notesSync, setNotesSync] = createSignal<CollectionSyncStatus>()

  async function fetchTodos(): Promise<void> {
    const result = await client.queryManager.list<Todo>('todos')
    setTodos(result.data)
  }

  async function fetchNotes(): Promise<void> {
    const result = await client.queryManager.list<Note>('notes')
    setNotes(result.data)
  }

  function markReady(collection: string): void {
    if (collection === 'todos') setTodosState('ready')
    if (collection === 'notes') setNotesState('ready')
  }

  function markError(collection: string): void {
    if (collection === 'todos') setTodosState('error')
    if (collection === 'notes') setNotesState('error')
  }

  function refreshSyncStatus(): void {
    setTodosSync(client.syncManager.getCollectionStatus('todos'))
    setNotesSync(client.syncManager.getCollectionStatus('notes'))
  }

  function recentIncompleteTodos(): Todo[] {
    return todos()
      .filter((t) => t.status !== 'completed')
      .slice(-5)
      .reverse()
  }

  function recentNotes(): Note[] {
    return notes().slice(-5).reverse()
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

    // Subscribe to live read-model updates BEFORE any async work.
    // This prevents a race where seeding completes between the initial fetch
    // and subscription setup, causing the dashboard to miss the update.
    const todoSub = client.queryManager.watchCollection('todos').subscribe(() => {
      fetchTodos()
    })
    const noteSub = client.queryManager.watchCollection('notes').subscribe(() => {
      fetchNotes()
    })

    // Subscribe to sync completion and failure to transition panels out of loading.
    const syncSub = client.events$
      .pipe(
        filter(
          (e): e is LibraryEvent<'sync:completed'> | LibraryEvent<'sync:failed'> =>
            e.type === 'sync:completed' || e.type === 'sync:failed',
        ),
      )
      .subscribe((event) => {
        refreshSyncStatus()
        if (event.type === 'sync:completed') {
          const fetch =
            event.payload.collection === 'todos'
              ? fetchTodos()
              : event.payload.collection === 'notes'
                ? fetchNotes()
                : null
          fetch?.then(() => markReady(event.payload.collection))
        } else {
          markError(event.payload.collection)
        }
      })

    // Handle the "already seeded / cached" case: if the collection was seeded
    // before this component mounted, fetch data and mark ready immediately.
    const todosSeeded = client.syncManager.getCollectionStatus('todos')?.seeded ?? false
    const notesSeeded = client.syncManager.getCollectionStatus('notes')?.seeded ?? false

    if (todosSeeded) fetchTodos().then(() => setTodosState('ready'))
    if (notesSeeded) fetchNotes().then(() => setNotesState('ready'))

    onCleanup(() => {
      todoSub.unsubscribe()
      noteSub.unsubscribe()
      syncSub.unsubscribe()
    })
  })

  return (
    <div class="max-w-4xl mx-auto px-4 py-8">
      <h1 class="text-2xl font-bold text-center mb-1">CQRS Client Demo</h1>
      <div class="text-center mb-8">
        <span class="mode-badge inline-block text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
          mode: {client.mode} | status: {client.status} | sync: todos=
          {syncLabel(todosSync())} notes={syncLabel(notesSync())}
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

        {/* Notes panel */}
        <div
          class={`rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 dash-notes-${notesState()}`}
        >
          <A
            href="/notes"
            class="block text-center text-lg font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 mb-4"
          >
            Notes &rarr;
          </A>
          <Show
            when={notesState() === 'ready'}
            fallback={
              <p class="text-neutral-400 text-sm">
                {notesState() === 'error' ? 'Sync failed.' : 'Loading...'}
              </p>
            }
          >
            <Show
              when={recentNotes().length > 0}
              fallback={<p class="dash-note-empty text-neutral-400 text-sm">No notes yet.</p>}
            >
              <ul class="space-y-2 p-0">
                <For each={recentNotes()}>
                  {(note) => (
                    <li class="dash-note-item text-sm">
                      <span class="dash-note-title font-medium truncate block">{note.title}</span>
                      <Show when={note.body.length > 0}>
                        <span class="text-neutral-500 truncate block">{note.body}</span>
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
