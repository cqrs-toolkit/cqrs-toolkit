import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { Todo } from '../../shared/todos/types'
import AddTodo from '../components/AddTodo'
import PageShell from '../components/PageShell'
import TodoItem from '../components/TodoItem'
import { useClient } from '../cqrs-context'

export default function TodosPage() {
  const client = useClient()
  const [todos, setTodos] = createSignal<Todo[]>([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string>()

  async function fetchTodos(): Promise<void> {
    const result = await client.queryManager.list<Todo>('todos')
    setTodos(result.data)
  }

  onMount(async () => {
    await fetchTodos()
    setLoading(false)

    const subscription = client.queryManager.watchCollection('todos').subscribe(() => {
      fetchTodos()
    })

    onCleanup(() => subscription.unsubscribe())
  })

  return (
    <PageShell title="Todos">
      <Show when={error()}>
        <p class="text-red-600 dark:text-red-400">{error()}</p>
      </Show>

      <AddTodo onError={setError} />

      <Show when={loading()}>
        <p class="text-center text-neutral-400 py-8">Loading...</p>
      </Show>

      <Show when={!loading() && todos().length === 0}>
        <p class="empty-state text-center text-neutral-400 py-8">No todos yet. Add one above.</p>
      </Show>

      <ul class="space-y-2 p-0">
        <For each={todos()}>{(todo) => <TodoItem todo={todo} onError={setError} />}</For>
      </ul>
    </PageShell>
  )
}
