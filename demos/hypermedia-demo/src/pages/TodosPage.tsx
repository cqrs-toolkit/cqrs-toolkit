import { createListQuery } from '@cqrs-toolkit/client-solid'
import { AddTodo, TodoItem } from '@cqrs-toolkit/demo-base/todos/components'
import type { Todo } from '@cqrs-toolkit/demo-base/todos/shared'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { useClient } from '../bootstrap/typed-client.js'
import PageShell from '../components/PageShell.js'
import { createEditNavigator } from '../primitives/createEditNavigator.js'

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
        <AddTodo
          onSubmitCreate={(p) => client.submit({ type: 'CreateTodo', data: p })}
          onError={setError}
          formRef={nav.headerRef}
        />

        <Show when={query.loading}>
          <p class="text-center text-neutral-400 py-8">Loading...</p>
        </Show>

        <Show when={!query.loading && sortedTodos().length === 0}>
          <p class="empty-state text-center text-neutral-400 py-8">No todos yet. Add one above.</p>
        </Show>

        <ul ref={nav.listRef} class="space-y-2 p-0">
          <For each={sortedTodos()}>
            {(todo) => (
              <TodoItem
                todo={todo}
                onSubmitChangeStatus={(p) =>
                  client.submit({
                    type: 'ChangeTodoStatus',
                    path: { id: p.id },
                    data: { status: p.status },
                    revision: p.revision,
                  })
                }
                onSubmitUpdateContent={(p) =>
                  client.submit({
                    type: 'UpdateTodoContent',
                    path: { id: p.id },
                    data: { content: p.content },
                    revision: p.revision,
                  })
                }
                onSubmitDelete={(p) =>
                  client.submit({
                    type: 'DeleteTodo',
                    path: { id: p.id },
                    data: {},
                    revision: p.revision,
                  })
                }
                onError={setError}
              />
            )}
          </For>
        </ul>
      </div>
    </PageShell>
  )
}
