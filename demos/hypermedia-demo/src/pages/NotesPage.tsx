import { type CollectionSyncStatus, type LibraryEvent } from '@cqrs-toolkit/client'
import { createListQuery } from '@cqrs-toolkit/client-solid'
import { NotebookList } from '@cqrs-toolkit/demo-base/notebooks/components'
import type { Notebook } from '@cqrs-toolkit/demo-base/notebooks/shared'
import { NoteEditor, NoteTitleList } from '@cqrs-toolkit/demo-base/notes/components'
import type { Note } from '@cqrs-toolkit/demo-base/notes/shared'
import { A } from '@solidjs/router'
import { filter } from 'rxjs'
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { useClient } from '../bootstrap/typed-client.js'

export default function NotesPage() {
  const client = useClient()
  const notebooksQuery = createListQuery<Notebook>(client.queryManager, 'notebooks')
  const notesQuery = createListQuery<Note>(client.queryManager, 'notes')

  const [selectedNotebookId, setSelectedNotebookId] = createSignal<string>()
  const [selectedNoteId, setSelectedNoteId] = createSignal<string>()
  const [editingTitle, setEditingTitle] = createSignal<string>()
  const [error, setError] = createSignal<string>()
  const [notebooksSync, setNotebooksSync] = createSignal<CollectionSyncStatus>()
  const [notesSync, setNotesSync] = createSignal<CollectionSyncStatus>()

  function refreshSyncStatus(): void {
    setNotebooksSync(client.syncManager.getCollectionStatus('notebooks'))
    setNotesSync(client.syncManager.getCollectionStatus('notes'))
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
          (e): e is LibraryEvent<'sync:completed'> | LibraryEvent<'sync:failed'> =>
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

  const notesForNotebook = createMemo(() => {
    const nbId = selectedNotebookId()
    if (!nbId) return []
    return notesQuery.items.filter((n) => n.notebookId === nbId)
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
            onSubmitCreate={(p) => client.submit({ type: 'CreateNotebook', data: p })}
            onSubmitRename={(p) =>
              client.submit({
                type: 'UpdateNotebookName',
                path: { id: p.id },
                data: { name: p.name },
                revision: p.revision,
              })
            }
            onSubmitDelete={(p) =>
              client.submit({
                type: 'DeleteNotebook',
                path: { id: p.id },
                data: {},
                revision: p.revision,
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
              notes={notesForNotebook()}
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
                onSubmitCreate={(p) => client.submit({ type: 'CreateNote', data: p })}
                onSubmitUpdateTitle={async (p) =>
                  client.submit({
                    type: 'UpdateNoteTitle',
                    path: { id: p.id },
                    data: { title: p.title },
                    revision: p.revision,
                  })
                }
                onSubmitUpdateBody={(p) =>
                  client.submit({
                    type: 'UpdateNoteBody',
                    path: { id: p.id },
                    data: { body: p.body },
                    revision: p.revision,
                  })
                }
                onSubmitDelete={(p) =>
                  client.submit({
                    type: 'DeleteNote',
                    path: { id: p.id },
                    data: {},
                    revision: p.revision,
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
