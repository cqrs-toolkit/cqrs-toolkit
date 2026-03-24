import { SaveIcon, TrashIcon } from '#common/components'
import type { Notebook } from '#notebooks/shared'
import type { AutoRevision, SubmitResult } from '@cqrs-toolkit/client'
import { useClient } from '@cqrs-toolkit/client-solid'
import { createSignal, For, Show } from 'solid-js'

interface NotebookListProps {
  notebooks: readonly Notebook[]
  selectedId: string | undefined
  onSelect: (id: string) => void
  onSubmitCreate: (params: { name: string }) => Promise<SubmitResult<unknown>>
  onSubmitRename: (params: {
    id: string
    name: string
    revision: AutoRevision
  }) => Promise<SubmitResult<unknown>>
  onSubmitDelete: (params: { id: string; revision: AutoRevision }) => Promise<SubmitResult<unknown>>
  onError: (message: string | undefined) => void
}

type SaveState = 'idle' | 'saving'
type RenameState = 'idle' | 'saving'

export function NotebookList(props: NotebookListProps) {
  const client = useClient()
  const [placeholderName, setPlaceholderName] = createSignal<string>()
  const [placeholderState, setPlaceholderState] = createSignal<SaveState>('idle')
  const [showTrash, setShowTrash] = createSignal(false)
  const [renamingId, setRenamingId] = createSignal<string>()
  const [renameName, setRenameName] = createSignal('')
  const [renameState, setRenameState] = createSignal<RenameState>('idle')

  function handleAddPlaceholder() {
    if (typeof placeholderName() === 'string') return
    setPlaceholderName('')
  }

  async function savePlaceholder() {
    if (placeholderState() !== 'idle') return
    const name = placeholderName()?.trim()
    if (!name || name.length === 0) {
      setPlaceholderName(undefined)
      return
    }

    props.onError(undefined)
    setPlaceholderState('saving')

    const result = await props.onSubmitCreate({ name })

    if (result.ok) {
      const [notebookId] = await client.getCommandEntities(result.value.commandId, 'notebooks')
      setPlaceholderName(undefined)
      if (notebookId) {
        props.onSelect(notebookId)
      }
    } else {
      props.onError(result.error.details?.errors[0]?.message ?? 'Command failed')
    }
    setPlaceholderState('idle')
  }

  function handlePlaceholderKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      savePlaceholder()
    } else if (e.key === 'Escape') {
      setPlaceholderName(undefined)
    }
  }

  function startRename(notebook: Notebook) {
    if (renameState() !== 'idle') return
    setRenamingId(notebook.id)
    setRenameName(notebook.name)
  }

  async function commitRename(notebook: Notebook) {
    if (renameState() !== 'idle') return
    const name = renameName().trim()
    if (name.length === 0 || name === notebook.name) {
      setRenamingId(undefined)
      return
    }

    props.onError(undefined)
    setRenameState('saving')

    const result = await props.onSubmitRename({
      id: notebook.id,
      name,
      revision: { __autoRevision: true, fallback: notebook.latestRevision },
    })

    if (!result.ok) {
      props.onError(result.error.details?.errors[0]?.message ?? 'Command failed')
    }
    setRenameState('idle')
    setRenamingId(undefined)
  }

  function handleRenameKeyDown(e: KeyboardEvent, notebook: Notebook) {
    if (e.key === 'Enter') {
      commitRename(notebook)
    } else if (e.key === 'Escape') {
      setRenamingId(undefined)
    }
  }

  async function handleDelete(notebook: Notebook) {
    props.onError(undefined)
    const result = await props.onSubmitDelete({
      id: notebook.id,
      revision: { __autoRevision: true, fallback: notebook.latestRevision },
    })
    if (!result.ok) {
      props.onError(result.error.details?.errors[0]?.message ?? 'Command failed')
    }
  }

  return (
    <div class="notebook-list flex flex-col h-full border-r border-neutral-200 dark:border-neutral-700">
      <div class="flex items-center justify-between p-2 border-b border-neutral-200 dark:border-neutral-700">
        <span class="text-xs font-medium text-neutral-500 uppercase">Notebooks</span>
        <div class="flex gap-1">
          <button
            class="add-notebook-btn px-2 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-sm cursor-pointer"
            onClick={handleAddPlaceholder}
            title="New notebook"
          >
            +
          </button>
          <button
            class={`toggle-trash p-1 rounded cursor-pointer ${
              showTrash()
                ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
            }`}
            onClick={() => setShowTrash((v) => !v)}
            title="Toggle delete"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </div>

      <ul class="flex-1 overflow-y-auto p-0">
        <Show when={typeof placeholderName() === 'string'}>
          <li
            class={`notebook-placeholder flex items-center gap-1 px-2 py-1.5 border-b border-neutral-100 dark:border-neutral-700 bg-indigo-50 dark:bg-indigo-900/30 ${
              placeholderState() === 'saving' ? 'add-saving' : 'add-idle'
            }`}
          >
            <input
              class="notebook-placeholder-input min-w-0 flex-1 px-1 py-0.5 rounded border border-indigo-500 dark:bg-neutral-800 text-sm focus:outline-none"
              type="text"
              placeholder="Notebook name"
              value={placeholderName() ?? ''}
              onInput={(e) => setPlaceholderName(e.currentTarget.value)}
              onKeyDown={handlePlaceholderKeyDown}
              disabled={placeholderState() === 'saving'}
              ref={(el) => setTimeout(() => el.focus(), 0)}
            />
            <button
              class="save-notebook p-0.5 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
              onClick={savePlaceholder}
              disabled={placeholderState() === 'saving'}
              title="Save"
            >
              <SaveIcon size={14} />
            </button>
          </li>
        </Show>
        <For each={props.notebooks}>
          {(notebook) => (
            <li
              class={`notebook-item flex items-center gap-1 px-2 py-1.5 cursor-pointer border-b border-neutral-100 dark:border-neutral-700 ${
                props.selectedId === notebook.id
                  ? 'notebook-selected bg-indigo-50 dark:bg-indigo-900/30'
                  : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
              onClick={() => props.onSelect(notebook.id)}
              onDblClick={() => startRename(notebook)}
            >
              <Show
                when={renamingId() !== notebook.id}
                fallback={
                  <input
                    class="rename-input min-w-0 flex-1 px-1 py-0.5 rounded border border-indigo-500 dark:bg-neutral-800 text-sm focus:outline-none"
                    type="text"
                    value={renameName()}
                    onInput={(e) => setRenameName(e.currentTarget.value)}
                    onKeyDown={(e) => handleRenameKeyDown(e, notebook)}
                    onBlur={() => commitRename(notebook)}
                    disabled={renameState() === 'saving'}
                    ref={(el) => setTimeout(() => el.focus(), 0)}
                  />
                }
              >
                <span class="notebook-name flex-1 text-sm truncate">{notebook.name}</span>
              </Show>
              <Show when={showTrash()}>
                <button
                  class="delete-notebook p-0.5 rounded text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(notebook)
                  }}
                  title="Delete notebook"
                >
                  <TrashIcon size={14} />
                </button>
              </Show>
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}
