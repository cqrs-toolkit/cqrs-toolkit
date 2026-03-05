import { createListQuery } from '@cqrs-toolkit/client-solid'
import { createMemo, createSignal, For, Show } from 'solid-js'
import type { Todo } from '../../shared/todos/types'
import { useClient } from '../bootstrap/cqrs-context'
import AddTodo from '../components/AddTodo'
import PageShell from '../components/PageShell'
import TodoItem from '../components/TodoItem'
import { createEditNavigator } from '../primitives/createEditNavigator'

export default function TodosPage() {
  const client = useClient()
  const nav = createEditNavigator()
  const [error, setError] = createSignal<string>()
  const query = createListQuery<Todo>(client.queryManager, 'todos')

  const sortedTodos = createMemo(() =>
    query.items.slice().sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1
      if (a.status !== 'completed' && b.status === 'completed') return -1
      return b.createdAt.localeCompare(a.createdAt)
    }),
  )

  return (
    <PageShell title="Todos">
      <Show when={error()}>
        <p class="text-red-600 dark:text-red-400">{error()}</p>
      </Show>

      <div ref={nav.containerRef}>
        <AddTodo onError={setError} formRef={nav.headerRef} />

        <Show when={query.loading}>
          <p class="text-center text-neutral-400 py-8">Loading...</p>
        </Show>

        <Show when={!query.loading && sortedTodos().length === 0}>
          <p class="empty-state text-center text-neutral-400 py-8">No todos yet. Add one above.</p>
        </Show>

        <ul ref={nav.listRef} class="space-y-2 p-0">
          <For each={sortedTodos()}>{(todo) => <TodoItem todo={todo} onError={setError} />}</For>
        </ul>
      </div>
    </PageShell>
  )
}
