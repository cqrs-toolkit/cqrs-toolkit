import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { Note } from '../../shared/notes/types'
import AddNote from '../components/AddNote'
import NoteItem from '../components/NoteItem'
import PageShell from '../components/PageShell'
import { useClient } from '../cqrs-context'

export default function NotesPage() {
  const client = useClient()
  const [notes, setNotes] = createSignal<Note[]>([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  async function fetchNotes(): Promise<void> {
    const result = await client.queryManager.list<Note>('notes')
    setNotes(result.data)
  }

  onMount(async () => {
    await fetchNotes()
    setLoading(false)

    const subscription = client.queryManager.watchCollection('notes').subscribe(() => {
      fetchNotes()
    })

    onCleanup(() => subscription.unsubscribe())
  })

  return (
    <PageShell title="Notes">
      <Show when={error()}>
        <p class="text-red-600 dark:text-red-400">{error()}</p>
      </Show>

      <AddNote onError={setError} />

      <Show when={loading()}>
        <p class="text-center text-neutral-400 py-8">Loading...</p>
      </Show>

      <Show when={!loading() && notes().length === 0}>
        <p class="empty-state text-center text-neutral-400 py-8">No notes yet. Add one above.</p>
      </Show>

      <ul class="space-y-2 p-0">
        <For each={notes()}>{(note) => <NoteItem note={note} onError={setError} />}</For>
      </ul>
    </PageShell>
  )
}
