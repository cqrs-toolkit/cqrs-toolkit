import { SaveIcon, TrashIcon } from '#common/components'
import type { Note } from '#notes/shared'
import type { AutoRevision, SubmitResult } from '@cqrs-toolkit/client'
import { createItemQuery, useClient } from '@cqrs-toolkit/client-solid'
import { createEffect, createSignal, Show } from 'solid-js'

interface NoteEditorProps {
  noteId: string
  notebookId: string
  onSubmitCreate: (params: {
    notebookId: string
    title: string
    body: string
  }) => Promise<SubmitResult<unknown>>
  onSubmitUpdateTitle: (params: {
    id: string
    title: string
    revision: AutoRevision
  }) => Promise<SubmitResult<unknown>>
  onSubmitUpdateBody: (params: {
    id: string
    body: string
    revision: AutoRevision
  }) => Promise<SubmitResult<unknown>>
  onSubmitDelete: (params: { id: string; revision: AutoRevision }) => Promise<SubmitResult<unknown>>
  onError: (message: string | undefined) => void
  onIdChanged: (previousId: string, newId: string) => void
  onDeleted: () => void
  onTitleChanged: (title: string) => void
}

type SaveState = 'idle' | 'saving' | 'deleting'

export function NoteEditor(props: NoteEditorProps) {
  const client = useClient()
  const query = createItemQuery<Note>(client.queryManager, 'notes', () => props.noteId)

  const [title, setTitle] = createSignal('')
  const [body, setBody] = createSignal('')
  const [saveState, setSaveState] = createSignal<SaveState>('idle')

  function isCreateMode(): boolean {
    return props.noteId === 'placeholder'
  }

  // Sync editor fields when item query data changes (edit mode)
  createEffect(() => {
    const note = query.data
    if (note) {
      setTitle(note.title)
      setBody(note.body)
    }
  })

  // Detect external deletion: query finished loading but returned no data (edit mode only)
  createEffect(() => {
    if (!query.loading && !query.data && !isCreateMode()) {
      props.onDeleted()
    }
  })

  // Detect reconciliation: item query followed client ID → server ID
  createEffect(() => {
    const reconciled = query.reconciledId
    if (reconciled) {
      props.onIdChanged(reconciled.clientId, reconciled.serverId)
    }
  })

  function handleTitleInput(value: string): void {
    setTitle(value)
    props.onTitleChanged(value)
  }

  async function handleSave() {
    if (saveState() !== 'idle') return
    const trimmedTitle = title().trim()
    if (trimmedTitle.length === 0) return

    props.onError(undefined)
    setSaveState('saving')

    if (isCreateMode()) {
      const result = await props.onSubmitCreate({
        notebookId: props.notebookId,
        title: trimmedTitle,
        body: body(),
      })
      if (result.ok) {
        const [noteId] = await client.getCommandEntities(result.value.commandId, 'notes')
        if (noteId) {
          props.onIdChanged('placeholder', noteId)
        }
      } else {
        props.onError(result.error.details?.errors[0]?.message ?? 'Command failed')
      }
    } else {
      const note = query.data
      if (!note) {
        setSaveState('idle')
        return
      }

      const titleChanged = trimmedTitle !== note.title
      const bodyChanged = body() !== note.body

      if (!titleChanged && !bodyChanged) {
        setSaveState('idle')
        return
      }

      const revision: AutoRevision = { __autoRevision: true, fallback: note.latestRevision }

      if (titleChanged) {
        const result = await props.onSubmitUpdateTitle({
          id: note.id,
          title: trimmedTitle,
          revision,
        })
        if (!result.ok) {
          setSaveState('idle')
          props.onError(result.error.details?.errors[0]?.message ?? 'Command failed')
          return
        }
      }

      if (bodyChanged) {
        const result = await props.onSubmitUpdateBody({
          id: note.id,
          body: body(),
          revision,
        })
        if (!result.ok) {
          setSaveState('idle')
          props.onError(result.error.details?.errors[0]?.message ?? 'Command failed')
          return
        }
      }
    }

    setSaveState('idle')
  }

  async function handleDelete() {
    if (saveState() !== 'idle') return
    if (isCreateMode()) {
      props.onDeleted()
      return
    }

    const note = query.data
    if (!note) return

    props.onError(undefined)
    setSaveState('deleting')
    const result = await props.onSubmitDelete({
      id: note.id,
      revision: { __autoRevision: true, fallback: note.latestRevision },
    })
    if (result.ok) {
      props.onDeleted()
    } else {
      setSaveState('idle')
      props.onError(result.error.details?.errors[0]?.message ?? 'Command failed')
    }
  }

  function isDisabled(): boolean {
    if (saveState() !== 'idle') return true
    if (isCreateMode()) return false
    if (!query.data || query.data.id !== props.noteId) return true
    return false
  }

  return (
    <div
      class={`note-editor flex flex-col h-full editor-${saveState()}${isCreateMode() ? ' editor-create' : query.loading ? ' editor-loading' : query.data ? ' editor-ready' : ' editor-not-found'}`}
      data-note-id={query.data?.id}
    >
      <div class="flex items-center gap-2 p-2 border-b border-neutral-200 dark:border-neutral-700">
        <input
          type="text"
          class="editor-title flex-1 px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={title()}
          onInput={(e) => handleTitleInput(e.currentTarget.value)}
          placeholder="Note title"
          disabled={isDisabled()}
        />
        <button
          class="save-note p-1.5 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
          onClick={handleSave}
          disabled={isDisabled()}
          title="Save"
        >
          <SaveIcon size={18} />
        </button>
        <button
          class="delete-note p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
          onClick={handleDelete}
          disabled={isDisabled()}
          title="Delete"
        >
          <TrashIcon size={18} />
        </button>
      </div>

      <textarea
        class="editor-body flex-1 w-full p-2 resize-none dark:bg-neutral-800 text-sm focus:outline-none"
        value={body()}
        onInput={(e) => setBody(e.currentTarget.value)}
        placeholder="Note body"
        disabled={isDisabled()}
      />

      <Show when={saveState() === 'saving'}>
        <div class="text-xs text-neutral-400 px-2 py-1">Saving...</div>
      </Show>
    </div>
  )
}
