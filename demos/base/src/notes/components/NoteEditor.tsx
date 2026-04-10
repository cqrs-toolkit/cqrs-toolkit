import { appCreateItemQuery, SaveIcon, TrashIcon } from '#common/components'
import { AttachmentList } from '#file-objects/components'
import {
  AutoRevision,
  EntityId,
  entityIdMatches,
  entityIdToString,
  SubmitResult,
} from '@cqrs-toolkit/client'
import { createEntityCacheKey, useClient } from '@cqrs-toolkit/client-solid'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { createEffect, createSignal, Show } from 'solid-js'
import type { Note } from '../domain/index.js'
import { NOTES_COLLECTION_NAME } from '../domain/index.js'

interface NoteEditorProps {
  noteId: EntityId
  notebookId: EntityId
  onSubmitCreate: (params: {
    notebookId: EntityId
    title: string
    body: string
  }) => Promise<SubmitResult<unknown>>
  onSubmitUpdateTitle: (params: {
    id: EntityId
    title: string
    revision: AutoRevision
  }) => Promise<SubmitResult<unknown>>
  onSubmitUpdateBody: (params: {
    id: EntityId
    body: string
    revision: AutoRevision
  }) => Promise<SubmitResult<unknown>>
  onSubmitDelete: (params: {
    id: EntityId
    revision: AutoRevision
  }) => Promise<SubmitResult<unknown>>
  onSubmitUploadFile?: (params: { noteId: EntityId; file: File }) => Promise<SubmitResult<unknown>>
  onSubmitDeleteFile?: (params: {
    id: EntityId
    revision: AutoRevision
  }) => Promise<SubmitResult<unknown>>
  onError: (message: string | undefined) => void
  onIdChanged: (previousId: EntityId, newId: EntityId) => void
  onDeleted: () => void
  onTitleChanged: (title: string) => void
}

type SaveState = 'idle' | 'saving' | 'deleting'

export function NoteEditor(props: NoteEditorProps) {
  const client = useClient<ServiceLink>()
  const notebookCacheKey = createEntityCacheKey<ServiceLink>(
    { service: 'nb', type: 'Notebook' },
    () => props.notebookId,
  )
  const query = appCreateItemQuery<Note>(
    client.queryManager,
    NOTES_COLLECTION_NAME,
    () => props.noteId,
    notebookCacheKey,
  )

  const [title, setTitle] = createSignal('')
  const [body, setBody] = createSignal('')
  const [saveState, setSaveState] = createSignal<SaveState>('idle')
  const [dragOver, setDragOver] = createSignal(false)

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
        const noteId = result.value.entityRef
        if (noteId) {
          props.onIdChanged('placeholder', noteId)
        }
      } else {
        props.onError(result.error.message)
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
          props.onError(result.error.message)
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
          props.onError(result.error.message)
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
      props.onError(result.error.message)
    }
  }

  function isDisabled(): boolean {
    if (saveState() !== 'idle') return true
    if (isCreateMode()) return false
    if (!query.data || !entityIdMatches(query.data.id, props.noteId)) return true
    return false
  }

  function handleDragOver(e: DragEvent) {
    if (isCreateMode() || !props.onSubmitUploadFile) return
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (isCreateMode() || !query.data || !props.onSubmitUploadFile) return

    const files = e.dataTransfer?.files
    if (!files) return
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file) {
        props.onSubmitUploadFile({ noteId: query.data.id, file })
      }
    }
  }

  return (
    <div
      class={`note-editor flex flex-col h-full editor-${saveState()}${isCreateMode() ? ' editor-create' : query.loading ? ' editor-loading' : query.data ? ' editor-ready' : ' editor-not-found'}${dragOver() ? ' drag-over' : ''}`}
      data-note-id={entityIdToString(query.data?.id)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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

      <Show
        when={!isCreateMode() && query.data && props.onSubmitUploadFile && props.onSubmitDeleteFile}
      >
        <AttachmentList
          noteId={props.noteId}
          notebookId={props.notebookId}
          onSubmitUpload={props.onSubmitUploadFile!}
          onSubmitDelete={props.onSubmitDeleteFile!}
        />
      </Show>

      <Show when={saveState() === 'saving'}>
        <div class="text-xs text-neutral-400 px-2 py-1">Saving...</div>
      </Show>
    </div>
  )
}
