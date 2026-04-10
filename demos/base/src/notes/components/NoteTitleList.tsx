import { EntityId, entityIdMatches } from '@cqrs-toolkit/client'
import { createMemo, createSignal, For, Show } from 'solid-js'
import type { Note } from '../domain/index.js'

interface NoteTitleListProps {
  notes: Note[]
  selectedId: EntityId | undefined
  onSelect: (id: EntityId) => void
  onAddPlaceholder: () => void
  /** Live title from the editor, used as display override for the selected note. */
  editingTitle: string | undefined
}

export function NoteTitleList(props: NoteTitleListProps) {
  const [search, setSearch] = createSignal('')

  const filteredNotes = createMemo(() => {
    const term = search().toLowerCase()
    if (term.length === 0) return props.notes
    return props.notes.filter((n) => n.title.toLowerCase().includes(term))
  })

  function displayTitle(note: Note): string {
    if (entityIdMatches(props.selectedId, note.id) && props.editingTitle !== undefined) {
      return props.editingTitle
    }
    return note.title
  }

  return (
    <div class="flex flex-col h-full border-r border-neutral-200 dark:border-neutral-700">
      <div class="flex items-center justify-between p-2 border-b border-neutral-200 dark:border-neutral-700">
        <span class="text-xs font-medium text-neutral-500 uppercase">Notes</span>
        <button
          class="add-note-btn px-2 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-sm cursor-pointer"
          onClick={() => props.onAddPlaceholder()}
          title="New note"
        >
          +
        </button>
      </div>

      <div class="px-2 py-1.5 border-b border-neutral-200 dark:border-neutral-700">
        <input
          type="text"
          placeholder="Search..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          class="note-search w-full px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <ul class="flex-1 overflow-y-auto p-0">
        <Show when={props.selectedId === 'placeholder'}>
          <li
            class="note-title-item flex items-center px-2 py-1.5 cursor-pointer border-b border-neutral-100 dark:border-neutral-700 bg-indigo-50 dark:bg-indigo-900/30"
            onClick={() => props.onSelect('placeholder')}
          >
            <span class="note-title text-sm truncate italic text-neutral-400">
              {props.editingTitle && props.editingTitle.length > 0
                ? props.editingTitle
                : 'New note'}
            </span>
          </li>
        </Show>
        <For each={filteredNotes()}>
          {(note) => (
            <li
              class={`note-title-item flex items-center px-2 py-1.5 cursor-pointer border-b border-neutral-100 dark:border-neutral-700 ${
                entityIdMatches(props.selectedId, note.id)
                  ? 'bg-indigo-50 dark:bg-indigo-900/30'
                  : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
              onClick={() => props.onSelect(note.id)}
            >
              <span class="note-title text-sm truncate">{displayTitle(note)}</span>
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}
