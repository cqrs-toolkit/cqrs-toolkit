import { createMutationEditState } from '#common/components'
import type { Todo, TodoStatus } from '#todos/shared'
import type { AutoRevision, SubmitResult } from '@cqrs-toolkit/client'
import { createSignal, Show } from 'solid-js'

const STATUS_CLASS: Record<TodoStatus, string> = {
  pending: 'pending',
  in_progress: 'in-progress',
  completed: 'completed',
}

interface TodoItemProps {
  todo: Todo
  onSubmitChangeStatus: (params: {
    id: string
    status: TodoStatus
    revision: AutoRevision
  }) => Promise<SubmitResult<unknown>>
  onSubmitUpdateContent: (params: {
    id: string
    content: string
    revision: AutoRevision
  }) => Promise<SubmitResult<unknown>>
  onSubmitDelete: (params: { id: string; revision: AutoRevision }) => Promise<SubmitResult<unknown>>
  onError: (message: string | undefined) => void
}

export function TodoItem(props: TodoItemProps) {
  const { editState, setEditState, setMutation, isMutating, canEdit, canSave, canDelete } =
    createMutationEditState<'saving-status'>()
  const canToggle = () => !isMutating()
  const [editText, setEditText] = createSignal('')
  let editInputRef: HTMLInputElement | undefined
  let liRef: HTMLLIElement | undefined

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
    if (!canToggle()) return
    props.onError(undefined)
    setMutation('saving-status')
    const result = await props.onSubmitChangeStatus({
      id: props.todo.id,
      status: nextStatus(props.todo.status),
      revision: { __autoRevision: true, fallback: props.todo.latestRevision },
    })
    setMutation('idle')
    if (result.ok) {
      setEditState('viewing')
    } else {
      props.onError(result.error.message)
    }
  }

  function startEdit() {
    if (!canEdit()) return
    setEditText(props.todo.content)
    setEditState('editing')
    editInputRef?.focus()
  }

  async function handleSave() {
    if (!canSave()) return

    const text = editText().trim()
    if (text.length === 0 || text === props.todo.content) {
      setEditState('viewing')
      return
    }

    setMutation('saving-edit')
    props.onError(undefined)
    const result = await props.onSubmitUpdateContent({
      id: props.todo.id,
      content: text,
      revision: { __autoRevision: true, fallback: props.todo.latestRevision },
    })
    setMutation('idle')
    if (result.ok) {
      setEditState('viewing')
    } else {
      props.onError(result.error.message)
    }
  }

  function cancelEdit() {
    if (isMutating()) return
    setEditState('viewing')
  }

  function handleFocusOut(e: FocusEvent) {
    if (editState() !== 'editing') return
    const target = e.target as Element | null
    if (!(target instanceof HTMLInputElement && target.classList.contains('edit-input'))) return
    const related = e.relatedTarget as Node | null
    if (related instanceof Node && (e.currentTarget as Node).contains(related)) return
    handleSave()
  }

  function handleEditKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape' && editState() === 'editing') {
      cancelEdit()
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && editState() === 'editing') {
      e.preventDefault()
      handleSave()
      liRef?.dispatchEvent(
        new CustomEvent('navedit', {
          bubbles: true,
          detail: { direction: e.key === 'ArrowUp' ? 'up' : 'down' },
        }),
      )
    }
  }

  async function handleDelete() {
    if (!canDelete()) return
    props.onError(undefined)
    setMutation('deleting')
    const result = await props.onSubmitDelete({
      id: props.todo.id,
      revision: { __autoRevision: true, fallback: props.todo.latestRevision },
    })
    if (!result.ok) {
      setMutation('idle')
      props.onError(result.error.message)
    }
  }

  return (
    <li
      ref={(el: HTMLLIElement) => {
        liRef = el
        el.addEventListener('requestedit', () => startEdit())
      }}
      id={`todo-${props.todo.id}`}
      class={`todo-item ${STATUS_CLASS[props.todo.status]} flex items-center gap-2 p-2 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800`}
      onFocusOut={handleFocusOut}
    >
      <input
        type="checkbox"
        checked={props.todo.status === 'completed'}
        onChange={handleToggle}
        disabled={isMutating()}
        class="accent-indigo-600"
      />

      <Show
        when={editState() !== 'viewing'}
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
          ref={editInputRef}
          class="edit-input flex-1 px-1 py-0.5 rounded border border-indigo-500 dark:bg-neutral-800 text-base focus:outline-none"
          type="text"
          value={editText()}
          onInput={(e) => setEditText(e.currentTarget.value)}
          onKeyDown={handleEditKeyDown}
          disabled={isMutating()}
        />
      </Show>

      <div class="flex gap-1">
        <Show when={editState() === 'viewing'}>
          <button
            class="px-3 py-1 rounded bg-neutral-500 text-white hover:bg-neutral-600 text-sm cursor-pointer"
            onClick={startEdit}
            disabled={isMutating()}
          >
            Edit
          </button>
        </Show>
        <Show when={editState() !== 'viewing'}>
          <button
            class="cancel-edit p-1 rounded bg-neutral-500 text-white hover:bg-neutral-600 cursor-pointer"
            onClick={cancelEdit}
            disabled={isMutating()}
            title="Cancel editing"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </button>
        </Show>
        <button
          class="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-sm cursor-pointer"
          onClick={handleDelete}
          disabled={isMutating()}
        >
          Del
        </button>
      </div>
    </li>
  )
}
