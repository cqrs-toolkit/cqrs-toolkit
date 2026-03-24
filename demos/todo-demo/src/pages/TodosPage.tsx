import { autoRevision } from '@cqrs-toolkit/client'
import { createListQuery, useClient } from '@cqrs-toolkit/client-solid'
import { AddTodo, TodoItem } from '@cqrs-toolkit/demo-base/todos/components'
import type { Todo } from '@cqrs-toolkit/demo-base/todos/shared'
import { createMemo, createSignal, For, Show } from 'solid-js'
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
                    data: { id: p.id, status: p.status },
                    revision: autoRevision(p.revision.fallback),
                  })
                }
                onSubmitUpdateContent={(p) =>
                  client.submit({
                    type: 'UpdateTodoContent',
                    data: { id: p.id, content: p.content },
                    revision: autoRevision(p.revision.fallback),
                  })
                }
                onSubmitDelete={(p) =>
                  client.submit({
                    type: 'DeleteTodo',
                    data: { id: p.id },
                    revision: autoRevision(p.revision.fallback),
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
