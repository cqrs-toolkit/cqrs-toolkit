import { type CollectionSyncStatus, deriveEntityKey, type LibraryEvent } from '@cqrs-toolkit/client'
import { appCreateListQuery } from '@cqrs-toolkit/demo-base/common/components'
import { NotebookList } from '@cqrs-toolkit/demo-base/notebooks/components'
import {
  NOTEBOOK_SEED_KEY,
  NOTEBOOKS_COLLECTION_NAME,
} from '@cqrs-toolkit/demo-base/notebooks/domain'
import type { Notebook } from '@cqrs-toolkit/demo-base/notebooks/shared'
import { NoteEditor, NoteTitleList } from '@cqrs-toolkit/demo-base/notes/components'
import type { Note } from '@cqrs-toolkit/demo-base/notes/shared'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { A } from '@solidjs/router'
import { filter } from 'rxjs'
import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { useClient } from '../bootstrap/typed-client.js'

export default function NotesPage() {
  const client = useClient()

  const [selectedNotebookId, setSelectedNotebookId] = createSignal<string>()
  const [selectedNoteId, setSelectedNoteId] = createSignal<string>()

  const notebooksQuery = appCreateListQuery<Notebook>(
    client.queryManager,
    NOTEBOOKS_COLLECTION_NAME,
    NOTEBOOK_SEED_KEY,
  )
  const notesQuery = appCreateListQuery<Note>(client.queryManager, 'notes', () =>
    selectedNotebookId()
      ? deriveEntityKey({ service: 'nb', type: 'Notebook', id: selectedNotebookId()! })
      : undefined,
  )
  function notebookCacheKey() {
    return deriveEntityKey({ service: 'nb', type: 'Notebook', id: selectedNotebookId()! })
  }

  const [editingTitle, setEditingTitle] = createSignal<string>()
  const [error, setError] = createSignal<string>()
  const [notebooksSync, setNotebooksSync] = createSignal<CollectionSyncStatus>()
  const [notesSync, setNotesSync] = createSignal<CollectionSyncStatus>()

  async function refreshSyncStatus(): Promise<void> {
    const notebooksStatus = await client.syncManager.getCollectionStatus(
      NOTEBOOKS_COLLECTION_NAME,
      NOTEBOOK_SEED_KEY,
    )
    setNotebooksSync(notebooksStatus)

    const nbId = selectedNotebookId()
    if (nbId) {
      const notesStatus = await client.syncManager.getCollectionStatus('notes', notebookCacheKey())
      setNotesSync(notesStatus)
    } else {
      setNotesSync(undefined)
    }
  }

  function syncLabel(status: CollectionSyncStatus | undefined): string {
    if (!status) return '?'
    if (status.error) return 'error'
    if (status.syncing) return 'syncing'
    if (status.seeded) return 'seeded'
    return 'pending'
  }

  onMount(() => {
    refreshSyncStatus()
    const syncSub = client.events$
      .pipe(
        filter(
          (
            e,
          ): e is
            | LibraryEvent<ServiceLink, 'sync:completed'>
            | LibraryEvent<ServiceLink, 'sync:failed'> =>
            e.type === 'sync:completed' || e.type === 'sync:failed',
        ),
      )
      .subscribe(() => {
        refreshSyncStatus()
      })

    onCleanup(() => {
      syncSub.unsubscribe()
    })
  })

  function handleSelectNotebook(id: string) {
    setSelectedNotebookId(id)
    setSelectedNoteId(undefined)
    setEditingTitle(undefined)
    setError(undefined)
  }

  function handleSelectNote(id: string) {
    setSelectedNoteId(id)
    setEditingTitle(undefined)
  }

  // Track notebook selection through ID reconciliation
  createEffect(() => {
    for (const { clientId, serverId } of notebooksQuery.reconciled) {
      if (selectedNotebookId() === clientId) {
        setSelectedNotebookId(serverId)
      }
    }
  })

  function handleEditorIdChanged(previousId: string, newId: string) {
    if (selectedNoteId() === previousId) {
      setSelectedNoteId(newId)
      setEditingTitle(undefined)
    }
  }

  return (
    <div class="flex flex-col h-screen">
      {/* Top bar */}
      <div class="flex items-center gap-3 px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
        <A
          href="/"
          class="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          &larr; Back
        </A>
        <span class="mode-badge text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
          mode: {client.mode} | status: {client.status} | sync: notebooks=
          {syncLabel(notebooksSync())} notes={syncLabel(notesSync())}
        </span>
      </div>

      <Show when={error()}>
        <p class="text-red-600 dark:text-red-400 text-sm px-3 py-1">{error()}</p>
      </Show>

      {/* 3-column layout */}
      <div class="flex flex-1 min-h-0">
        {/* Left: notebooks */}
        <div class="w-56 flex-shrink-0 overflow-hidden">
          <NotebookList
            notebooks={notebooksQuery.items}
            selectedId={selectedNotebookId()}
            onSelect={handleSelectNotebook}
            onSubmitCreate={(p) =>
              client.submit({
                command: { type: 'nb.CreateNotebook', data: p },
                cacheKey: NOTEBOOK_SEED_KEY,
              })
            }
            onSubmitRename={(p) =>
              client.submit({
                command: {
                  type: 'nb.UpdateNotebookName',
                  path: { id: p.id },
                  data: { name: p.name },
                  revision: p.revision,
                },
                cacheKey: NOTEBOOK_SEED_KEY,
              })
            }
            onSubmitDelete={(p) =>
              client.submit({
                command: {
                  type: 'nb.DeleteNotebook',
                  path: { id: p.id },
                  data: {},
                  revision: p.revision,
                },
                cacheKey: NOTEBOOK_SEED_KEY,
              })
            }
            onError={setError}
          />
        </div>

        {/* Middle: note titles */}
        <div class="w-56 flex-shrink-0 overflow-hidden">
          <Show
            when={selectedNotebookId()}
            fallback={
              <div class="flex items-center justify-center h-full text-neutral-400 text-sm">
                Select a notebook
              </div>
            }
          >
            <NoteTitleList
              notes={notesQuery.items}
              selectedId={selectedNoteId()}
              onSelect={handleSelectNote}
              onAddPlaceholder={() => handleSelectNote('placeholder')}
              editingTitle={editingTitle()}
            />
          </Show>
        </div>

        {/* Right: editor */}
        <div class="flex-1 min-w-0 overflow-hidden">
          <Show
            when={selectedNoteId()}
            fallback={
              <div class="flex items-center justify-center h-full text-neutral-400 text-sm">
                {selectedNotebookId() ? 'Select or create a note' : ''}
              </div>
            }
          >
            {(noteId) => (
              <NoteEditor
                noteId={noteId()}
                notebookId={selectedNotebookId()!}
                onSubmitCreate={(p) =>
                  client.submit({
                    command: { type: 'nb.CreateNote', data: p },
                    cacheKey: notebookCacheKey(),
                  })
                }
                onSubmitUpdateTitle={async (p) =>
                  client.submit({
                    command: {
                      type: 'nb.UpdateNoteTitle',
                      path: { id: p.id },
                      data: { title: p.title },
                      revision: p.revision,
                    },
                    cacheKey: notebookCacheKey(),
                  })
                }
                onSubmitUpdateBody={(p) =>
                  client.submit({
                    command: {
                      type: 'nb.UpdateNoteBody',
                      path: { id: p.id },
                      data: { body: p.body },
                      revision: p.revision,
                    },
                    cacheKey: notebookCacheKey(),
                  })
                }
                onSubmitDelete={(p) =>
                  client.submit({
                    command: {
                      type: 'nb.DeleteNote',
                      path: { id: p.id },
                      data: {},
                      revision: p.revision,
                    },
                    cacheKey: notebookCacheKey(),
                  })
                }
                onSubmitUploadFile={(p) =>
                  client.submit({
                    command: {
                      type: 'storage.CreateFileObject',
                      data: { noteId: p.noteId, filename: p.file.name, size: p.file.size },
                      files: [p.file],
                    },
                    cacheKey: notebookCacheKey(),
                  })
                }
                onSubmitDeleteFile={(p) =>
                  client.submit({
                    command: {
                      type: 'storage.DeleteFileObject',
                      path: { id: p.id },
                      data: {},
                      revision: p.revision,
                    },
                    cacheKey: notebookCacheKey(),
                  })
                }
                onError={setError}
                onIdChanged={handleEditorIdChanged}
                onDeleted={() => setSelectedNoteId(undefined)}
                onTitleChanged={setEditingTitle}
              />
            )}
          </Show>
        </div>
      </div>
    </div>
  )
}
