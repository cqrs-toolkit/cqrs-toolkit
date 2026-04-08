import {
  deriveScopeKey,
  entityIdToString,
  type CollectionSyncStatus,
  type EntityId,
  type LibraryEvent,
} from '@cqrs-toolkit/client'
import { createEntityCacheKey, useClient } from '@cqrs-toolkit/client-solid'
import { appCreateListQuery } from '@cqrs-toolkit/demo-base/common/components'
import { NotebookList } from '@cqrs-toolkit/demo-base/notebooks/components'
import { NOTEBOOK_SEED_KEY } from '@cqrs-toolkit/demo-base/notebooks/domain'
import type { Notebook } from '@cqrs-toolkit/demo-base/notebooks/shared'
import { NoteEditor, NoteTitleList } from '@cqrs-toolkit/demo-base/notes/components'
import type { Note } from '@cqrs-toolkit/demo-base/notes/shared'
import { ServiceLink } from '@meticoeus/ddd-es'
import { A } from '@solidjs/router'
import { filter } from 'rxjs'
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'

export default function NotesPage() {
  const client = useClient<ServiceLink>()

  const [selectedNotebookId, setSelectedNotebookId] = createSignal<EntityId>()
  const [selectedNoteId, setSelectedNoteId] = createSignal<string>()

  const notebookCacheKey = createEntityCacheKey<ServiceLink>(
    { service: 'nb', type: 'Notebook' },
    () => selectedNotebookId(),
  )
  const noteEditorCtx = createMemo(() => {
    const noteId = selectedNoteId()
    const cacheKey = notebookCacheKey()
    if (!noteId || !cacheKey) return undefined
    return { noteId, notebookId: cacheKey.link.id, cacheKey }
  })

  const notebooksQuery = appCreateListQuery<Notebook>(
    client.queryManager,
    'notebooks',
    deriveScopeKey({ scopeType: 'notebooks' }),
  )
  const notesQuery = appCreateListQuery<Note>(client.queryManager, 'notes', notebookCacheKey)

  const [editingTitle, setEditingTitle] = createSignal<string>()
  const [error, setError] = createSignal<string>()
  const [notebooksSync, setNotebooksSync] = createSignal<CollectionSyncStatus>()
  const [notesSync, setNotesSync] = createSignal<CollectionSyncStatus>()

  async function refreshSyncStatus(): Promise<void> {
    const notebooksStatus = await client.syncManager.getCollectionStatus(
      'notebooks',
      NOTEBOOK_SEED_KEY,
    )
    setNotebooksSync(notebooksStatus)

    const nbCacheKey = notebookCacheKey()
    if (nbCacheKey) {
      const notesStatus = await client.syncManager.getCollectionStatus('notes', nbCacheKey)
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

  function handleSelectNotebook(id: EntityId) {
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
    const currentId = selectedNotebookId()
    if (typeof currentId === 'undefined') return
    for (const { clientId, serverId } of notebooksQuery.reconciled) {
      if (entityIdToString(currentId) === clientId) {
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
            selectedId={notebookCacheKey()?.link.id}
            onSelect={handleSelectNotebook}
            onSubmitCreate={(p) =>
              client.submit({
                command: { type: 'CreateNotebook', data: p },
                cacheKey: NOTEBOOK_SEED_KEY,
              })
            }
            onSubmitRename={(p) =>
              client.submit({
                command: {
                  type: 'UpdateNotebookName',
                  data: { id: p.id, name: p.name },
                  revision: p.revision,
                },
                cacheKey: NOTEBOOK_SEED_KEY,
              })
            }
            onSubmitDelete={(p) =>
              client.submit({
                command: {
                  type: 'DeleteNotebook',
                  data: { id: p.id },
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
            when={notebookCacheKey()}
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
            when={noteEditorCtx()}
            fallback={
              <div class="flex items-center justify-center h-full text-neutral-400 text-sm">
                {notebookCacheKey() ? 'Select or create a note' : ''}
              </div>
            }
          >
            {(ctx) => (
              <NoteEditor
                noteId={ctx().noteId}
                notebookId={ctx().notebookId}
                onSubmitCreate={(p) =>
                  client.submit({
                    command: { type: 'CreateNote', data: p },
                    cacheKey: ctx().cacheKey,
                  })
                }
                onSubmitUpdateTitle={(p) =>
                  client.submit({
                    command: {
                      type: 'UpdateNoteTitle',
                      data: { id: p.id, title: p.title },
                      revision: p.revision,
                    },
                    cacheKey: ctx().cacheKey,
                  })
                }
                onSubmitUpdateBody={(p) =>
                  client.submit({
                    command: {
                      type: 'UpdateNoteBody',
                      data: { id: p.id, body: p.body },
                      revision: p.revision,
                    },
                    cacheKey: ctx().cacheKey,
                  })
                }
                onSubmitDelete={(p) =>
                  client.submit({
                    command: {
                      type: 'DeleteNote',
                      data: { id: p.id },
                      revision: p.revision,
                    },
                    cacheKey: ctx().cacheKey,
                  })
                }
                onSubmitUploadFile={(p) =>
                  client.submit({
                    command: {
                      type: 'CreateFileObject',
                      data: { noteId: p.noteId },
                      files: [p.file],
                    },
                    cacheKey: ctx().cacheKey,
                  })
                }
                onSubmitDeleteFile={(p) =>
                  client.submit({
                    command: {
                      type: 'DeleteFileObject',
                      data: { id: p.id },
                      revision: p.revision,
                    },
                    cacheKey: ctx().cacheKey,
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
