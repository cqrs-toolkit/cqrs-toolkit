import { createSignal, Show } from 'solid-js'
import type { Note } from '../../shared/notes/types'
import { useClient } from '../cqrs-context'

interface NoteItemProps {
  note: Note
  onError: (message: string | null) => void
}

export default function NoteItem(props: NoteItemProps) {
  const { commandQueue } = useClient()
  const [editing, setEditing] = createSignal(false)
  const [editTitle, setEditTitle] = createSignal('')
  const [editBody, setEditBody] = createSignal('')

  function startEdit() {
    setEditTitle(props.note.title)
    setEditBody(props.note.body)
    setEditing(true)
  }

  async function handleSave() {
    const trimmedTitle = editTitle().trim()
    if (trimmedTitle.length === 0) {
      setEditing(false)
      return
    }

    const titleChanged = trimmedTitle !== props.note.title
    const bodyChanged = editBody() !== props.note.body

    if (!titleChanged && !bodyChanged) {
      setEditing(false)
      return
    }

    props.onError(null)

    if (titleChanged) {
      const result = await commandQueue.enqueueAndWait({
        type: 'UpdateNoteTitle',
        payload: { id: props.note.id, title: trimmedTitle, revision: props.note.latestRevision },
      })
      if (!result.ok) {
        props.onError(result.errors[0]?.message ?? 'Command failed')
        return
      }
    }

    if (bodyChanged) {
      const result = await commandQueue.enqueueAndWait({
        type: 'UpdateNoteBody',
        payload: { id: props.note.id, body: editBody(), revision: props.note.latestRevision },
      })
      if (!result.ok) {
        props.onError(result.errors[0]?.message ?? 'Command failed')
        return
      }
    }

    setEditing(false)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
      handleSave()
    } else if (e.key === 'Escape') {
      setEditing(false)
    }
  }

  async function handleDelete() {
    props.onError(null)
    const result = await commandQueue.enqueueAndWait({
      type: 'DeleteNote',
      payload: { id: props.note.id, revision: props.note.latestRevision },
    })
    if (!result.ok) {
      props.onError(result.errors[0]?.message ?? 'Command failed')
    }
  }

  return (
    <li
      id={`note-${props.note.id}`}
      class="note-item p-3 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
    >
      <Show
        when={editing()}
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
                >
                  Edit
                </button>
                <button
                  class="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-sm cursor-pointer"
                  onClick={handleDelete}
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
              class="flex-1 px-1 py-0.5 rounded border border-indigo-500 dark:bg-neutral-800 text-base focus:outline-none font-medium"
              type="text"
              value={editTitle()}
              onInput={(e) => setEditTitle(e.currentTarget.value)}
              autofocus
            />
            <div class="flex gap-1">
              <button
                class="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-sm cursor-pointer"
                onClick={handleDelete}
              >
                Del
              </button>
            </div>
          </div>
          <textarea
            class="w-full px-1 py-0.5 rounded border border-indigo-500 dark:bg-neutral-800 text-sm focus:outline-none"
            value={editBody()}
            onInput={(e) => setEditBody(e.currentTarget.value)}
            onBlur={handleSave}
            rows={3}
          />
        </div>
      </Show>
    </li>
  )
}
