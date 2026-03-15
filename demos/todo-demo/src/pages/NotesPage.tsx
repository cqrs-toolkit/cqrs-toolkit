import { createListQuery } from '@cqrs-toolkit/client-solid'
import { createSignal, For, Show } from 'solid-js'
import type { Note } from '../../shared/notes/types.js'
import { useClient } from '../bootstrap/cqrs-context.js'
import AddNote from '../components/AddNote.js'
import NoteItem from '../components/NoteItem.js'
import PageShell from '../components/PageShell.js'
import { createEditNavigator } from '../primitives/createEditNavigator.js'

export default function NotesPage() {
  const client = useClient()
  const nav = createEditNavigator()
  const [error, setError] = createSignal<string>()
  const query = createListQuery<Note>(client.queryManager, 'notes')

  return (
    <PageShell title="Notes">
      <Show when={error()}>
        <p class="text-red-600 dark:text-red-400">{error()}</p>
      </Show>

      <div ref={nav.containerRef}>
        <AddNote onError={setError} formRef={nav.headerRef} />

        <Show when={query.loading}>
          <p class="text-center text-neutral-400 py-8">Loading...</p>
        </Show>

        <Show when={!query.loading && query.items.length === 0}>
          <p class="empty-state text-center text-neutral-400 py-8">No notes yet. Add one above.</p>
        </Show>

        <ul ref={nav.listRef} class="space-y-2 p-0">
          <For each={query.items}>{(note) => <NoteItem note={note} onError={setError} />}</For>
        </ul>
      </div>
    </PageShell>
  )
}
