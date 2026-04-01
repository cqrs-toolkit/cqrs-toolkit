import { deriveScopeKey } from '@cqrs-toolkit/client'
import { appCreateListQuery } from '@cqrs-toolkit/demo-base/common/components'
import { AddTodo, TodoItem } from '@cqrs-toolkit/demo-base/todos/components'
import { TODO_SEED_KEY } from '@cqrs-toolkit/demo-base/todos/domain'
import type { Todo } from '@cqrs-toolkit/demo-base/todos/shared'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { useClient } from '../bootstrap/typed-client.js'
import PageShell from '../components/PageShell.js'
import { createEditNavigator } from '../primitives/createEditNavigator.js'

export default function TodosPage() {
  const client = useClient()
  const nav = createEditNavigator()
  const [error, setError] = createSignal<string>()
  const query = appCreateListQuery<Todo>(
    client.queryManager,
    'todos',
    deriveScopeKey({ scopeType: 'todos' }),
  )

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
          onSubmitCreate={(p) =>
            client.submit({
              command: { type: 'nb.CreateTodo', data: p },
              cacheKey: TODO_SEED_KEY,
            })
          }
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
                    command: {
                      type: 'nb.ChangeTodoStatus',
                      path: { id: p.id },
                      data: { status: p.status },
                      revision: p.revision,
                    },
                    cacheKey: TODO_SEED_KEY,
                  })
                }
                onSubmitUpdateContent={(p) =>
                  client.submit({
                    command: {
                      type: 'nb.UpdateTodoContent',
                      path: { id: p.id },
                      data: { content: p.content },
                      revision: p.revision,
                    },
                    cacheKey: TODO_SEED_KEY,
                  })
                }
                onSubmitDelete={(p) =>
                  client.submit({
                    command: {
                      type: 'nb.DeleteTodo',
                      path: { id: p.id },
                      data: {},
                      revision: p.revision,
                    },
                    cacheKey: TODO_SEED_KEY,
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
