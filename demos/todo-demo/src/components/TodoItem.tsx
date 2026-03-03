import { createSignal, Show } from 'solid-js'
import type { Todo, TodoStatus } from '../../shared/todos/types'
import { useClient } from '../cqrs-context'

interface TodoItemProps {
  todo: Todo
  onError: (message: string | undefined) => void
}

export default function TodoItem(props: TodoItemProps) {
  const { commandQueue } = useClient()
  const [editing, setEditing] = createSignal(false)
  const [editText, setEditText] = createSignal('')

  function nextStatus(current: TodoStatus): TodoStatus {
    switch (current) {
      case 'pending':
        return 'in_progress'
      case 'in_progress':
        return 'completed'
      case 'completed':
        return 'pending'
    }
  }

  async function handleToggle() {
    props.onError(undefined)
    const result = await commandQueue.enqueueAndWait({
      type: 'ChangeTodoStatus',
      payload: {
        id: props.todo.id,
        status: nextStatus(props.todo.status),
        revision: props.todo.latestRevision,
      },
    })
    if (!result.ok) {
      props.onError(result.error.details?.errors[0]?.message ?? 'Command failed')
    }
  }

  function startEdit() {
    setEditText(props.todo.content)
    setEditing(true)
  }

  async function handleSave() {
    const text = editText().trim()
    if (text.length === 0 || text === props.todo.content) {
      setEditing(false)
      return
    }

    props.onError(undefined)
    const result = await commandQueue.enqueueAndWait({
      type: 'UpdateTodoContent',
      payload: { id: props.todo.id, content: text, revision: props.todo.latestRevision },
    })
    if (result.ok) {
      setEditing(false)
    } else {
      props.onError(result.error.details?.errors[0]?.message ?? 'Command failed')
    }
  }

  function handleEditKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setEditing(false)
    }
  }

  async function handleDelete() {
    props.onError(undefined)
    const result = await commandQueue.enqueueAndWait({
      type: 'DeleteTodo',
      payload: { id: props.todo.id, revision: props.todo.latestRevision },
    })
    if (!result.ok) {
      props.onError(result.error.details?.errors[0]?.message ?? 'Command failed')
    }
  }

  return (
    <li
      id={`todo-${props.todo.id}`}
      class={`todo-item flex items-center gap-2 p-2 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800${props.todo.status === 'completed' ? ' completed' : ''}`}
    >
      <input
        type="checkbox"
        checked={props.todo.status === 'completed'}
        onChange={handleToggle}
        class="accent-indigo-600"
      />

      <Show
        when={editing()}
        fallback={
          <span
            class={`todo-content flex-1 ${props.todo.status === 'completed' ? 'line-through text-neutral-400' : ''}`}
            onDblClick={startEdit}
          >
            {props.todo.content}
          </span>
        }
      >
        <input
          class="edit-input flex-1 px-1 py-0.5 rounded border border-indigo-500 dark:bg-neutral-800 text-base focus:outline-none"
          type="text"
          value={editText()}
          onInput={(e) => setEditText(e.currentTarget.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={handleSave}
          autofocus
        />
      </Show>

      <div class="flex gap-1">
        <Show when={!editing()}>
          <button
            class="px-3 py-1 rounded bg-neutral-500 text-white hover:bg-neutral-600 text-sm cursor-pointer"
            onClick={startEdit}
          >
            Edit
          </button>
        </Show>
        <button
          class="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-sm cursor-pointer"
          onClick={handleDelete}
        >
          Del
        </button>
      </div>
    </li>
  )
}
