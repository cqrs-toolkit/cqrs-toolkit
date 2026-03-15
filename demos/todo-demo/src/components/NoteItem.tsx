import { autoRevision } from '@cqrs-toolkit/client'
import { createSignal, Show } from 'solid-js'
import type { Note } from '../../shared/notes/types.js'
import { useClient } from '../bootstrap/cqrs-context.js'
import { createMutationEditState } from './createMutationEditState.js'

interface NoteItemProps {
  note: Note
  onError: (message: string | undefined) => void
}

export default function NoteItem(props: NoteItemProps) {
  const client = useClient()
  const { editState, setEditState, setMutation, isMutating, canEdit, canSave, canDelete } =
    createMutationEditState()
  const [editTitle, setEditTitle] = createSignal('')
  const [editBody, setEditBody] = createSignal('')
  let editTitleRef: HTMLInputElement | undefined
  let liRef: HTMLLIElement | undefined

  function startEdit() {
    if (!canEdit()) return
    setEditTitle(props.note.title)
    setEditBody(props.note.body)
    setEditState('editing')
    editTitleRef?.focus()
  }

  async function handleSave() {
    if (!canSave()) return

    const trimmedTitle = editTitle().trim()
    if (trimmedTitle.length === 0) {
      setEditState('viewing')
      return
    }

    const titleChanged = trimmedTitle !== props.note.title
    const bodyChanged = editBody() !== props.note.body

    if (!titleChanged && !bodyChanged) {
      setEditState('viewing')
      return
    }

    setMutation('saving-edit')
    props.onError(undefined)

    if (titleChanged) {
      const result = await client.submit({
        type: 'UpdateNoteTitle',
        payload: {
          id: props.note.id,
          title: trimmedTitle,
          revision: autoRevision(props.note.latestRevision),
        },
      })
      if (!result.ok) {
        setMutation('idle')
        props.onError(result.error.details?.errors[0]?.message ?? 'Command failed')
        return
      }
    }

    if (bodyChanged) {
      const result = await client.submit({
        type: 'UpdateNoteBody',
        payload: {
          id: props.note.id,
          body: editBody(),
          revision: autoRevision(props.note.latestRevision),
        },
      })
      if (!result.ok) {
        setMutation('idle')
        props.onError(result.error.details?.errors[0]?.message ?? 'Command failed')
        return
      }
    }

    setMutation('idle')
    setEditState('viewing')
  }

  function cancelEdit() {
    if (isMutating()) return
    setEditState('viewing')
  }

  function handleFocusOut(e: FocusEvent) {
    if (editState() !== 'editing') return
    const target = e.target as Element | null
    if (
      !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) ||
      !target.classList.contains('edit-input')
    ) {
      return
    }
    const related = e.relatedTarget as Node | null
    if (related instanceof Node && (e.currentTarget as Node).contains(related)) return
    handleSave()
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
      handleSave()
    } else if (e.key === 'Escape' && editState() === 'editing') {
      cancelEdit()
    } else if (
      (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
      editState() === 'editing' &&
      !(e.target instanceof HTMLTextAreaElement)
    ) {
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
    const result = await client.submit({
      type: 'DeleteNote',
      payload: { id: props.note.id, revision: autoRevision(props.note.latestRevision) },
    })
    if (!result.ok) {
      setMutation('idle')
      props.onError(result.error.details?.errors[0]?.message ?? 'Command failed')
    }
  }

  return (
    <li
      ref={(el: HTMLLIElement) => {
        liRef = el
        el.addEventListener('requestedit', () => startEdit())
      }}
      id={`note-${props.note.id}`}
      class="note-item p-3 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
      onFocusOut={handleFocusOut}
    >
      <Show
        when={editState() !== 'viewing'}
        fallback={
          <>
            <div class="flex items-center gap-2">
              <span class="note-title flex-1 font-medium" onDblClick={startEdit}>
                {props.note.title}
              </span>
              <div class="flex gap-1">
                <button
                  class="px-3 py-1 rounded bg-neutral-500 text-white hover:bg-neutral-600 text-sm cursor-pointer"
                  onClick={startEdit}
                  disabled={isMutating()}
                >
                  Edit
                </button>
                <button
                  class="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-sm cursor-pointer"
                  onClick={handleDelete}
                  disabled={isMutating()}
                >
                  Del
                </button>
              </div>
            </div>
            <Show
              when={props.note.body.length > 0}
              fallback={<p class="text-sm text-neutral-400 italic mt-1">No body</p>}
            >
              <p class="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap mt-1">
                {props.note.body}
              </p>
            </Show>
          </>
        }
      >
        <div class="space-y-2" onKeyDown={handleKeyDown}>
          <div class="flex items-center gap-2">
            <input
              ref={editTitleRef}
              class="edit-input flex-1 px-1 py-0.5 rounded border border-indigo-500 dark:bg-neutral-800 text-base focus:outline-none font-medium"
              type="text"
              value={editTitle()}
              onInput={(e) => setEditTitle(e.currentTarget.value)}
              disabled={isMutating()}
            />
            <div class="flex gap-1">
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
              <button
                class="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-sm cursor-pointer"
                onClick={handleDelete}
                disabled={isMutating()}
              >
                Del
              </button>
            </div>
          </div>
          <textarea
            class="edit-input w-full px-1 py-0.5 rounded border border-indigo-500 dark:bg-neutral-800 text-sm focus:outline-none"
            value={editBody()}
            onInput={(e) => setEditBody(e.currentTarget.value)}
            disabled={isMutating()}
            rows={3}
          />
        </div>
      </Show>
    </li>
  )
}
