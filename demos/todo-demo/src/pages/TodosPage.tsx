import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { Todo } from '../../shared/todos/types'
import { useClient } from '../bootstrap/cqrs-context'
import AddTodo from '../components/AddTodo'
import PageShell from '../components/PageShell'
import TodoItem from '../components/TodoItem'
import { createEditNavigator } from '../primitives/createEditNavigator'

export default function TodosPage() {
  const client = useClient()
  const nav = createEditNavigator()
  const [todos, setTodos] = createSignal<Todo[]>([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string>()
  let cacheKey: string | undefined

  async function fetchTodos(): Promise<void> {
    const result = await client.queryManager.list<Todo>('todos', { hold: true })
    cacheKey = result.cacheKey
    setTodos(result.data)
  }

  onMount(async () => {
    await fetchTodos()
    setLoading(false)

    const subscription = client.queryManager.watchCollection('todos').subscribe(() => {
      fetchTodos()
    })

    onCleanup(() => {
      subscription.unsubscribe()
      if (cacheKey) client.queryManager.release(cacheKey)
    })
  })

  function sortedTodos(): Todo[] {
    return todos()
      .slice()
      .sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1
        if (a.status !== 'completed' && b.status === 'completed') return -1
        return b.createdAt.localeCompare(a.createdAt)
      })
  }

  return (
    <PageShell title="Todos">
      <Show when={error()}>
        <p class="text-red-600 dark:text-red-400">{error()}</p>
      </Show>

      <div ref={nav.containerRef}>
        <AddTodo onError={setError} formRef={nav.headerRef} />

        <Show when={loading()}>
          <p class="text-center text-neutral-400 py-8">Loading...</p>
        </Show>

        <Show when={!loading() && todos().length === 0}>
          <p class="empty-state text-center text-neutral-400 py-8">No todos yet. Add one above.</p>
        </Show>

        <ul ref={nav.listRef} class="space-y-2 p-0">
          <For each={sortedTodos()}>{(todo) => <TodoItem todo={todo} onError={setError} />}</For>
        </ul>
      </div>
    </PageShell>
  )
}
