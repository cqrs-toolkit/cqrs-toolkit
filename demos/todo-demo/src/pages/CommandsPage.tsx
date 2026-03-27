import type { CommandRecord, CommandStatus } from '@cqrs-toolkit/client'
import { useClient } from '@cqrs-toolkit/client-solid'
import { CommandItem, StatusFilter } from '@cqrs-toolkit/demo-base/commands/components'
import { ServiceLink } from '@meticoeus/ddd-es'
import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import PageShell from '../components/PageShell.js'

const ALL_STATUSES = new Set<CommandStatus>([
  'pending',
  'blocked',
  'sending',
  'succeeded',
  'failed',
  'cancelled',
])

export default function CommandsPage() {
  const client = useClient<ServiceLink>()
  const [commands, setCommands] = createSignal<CommandRecord<ServiceLink>[]>([])
  const [searchText, setSearchText] = createSignal('')
  const [selectedStatuses, setSelectedStatuses] = createSignal<Set<CommandStatus>>(
    new Set(ALL_STATUSES),
  )
  const [expandedId, setExpandedId] = createSignal<string | null>(null)

  async function fetchCommands(): Promise<void> {
    const list = await client.commandQueue.listCommands()
    // Sort by createdAt descending (most recent first)
    list.sort((a, b) => b.createdAt - a.createdAt)
    setCommands(list)
  }

  const filteredCommands = createMemo(() => {
    const search = searchText().toLowerCase()
    const statuses = selectedStatuses()

    return commands().filter((cmd) => {
      if (!statuses.has(cmd.status)) return false
      if (search.length === 0) return true

      return (
        cmd.commandId.toLowerCase().includes(search) ||
        cmd.type.toLowerCase().includes(search) ||
        JSON.stringify(cmd.data).toLowerCase().includes(search)
      )
    })
  })

  function toggleExpanded(commandId: string) {
    setExpandedId((current) => (current === commandId ? null : commandId))
  }

  onMount(() => {
    fetchCommands()

    const subscription = client.commandQueue.events$.subscribe(() => {
      fetchCommands()
    })

    onCleanup(() => subscription.unsubscribe())
  })

  return (
    <PageShell title="Command Queue">
      {/* Toolbar */}
      <div class="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Search commands..."
          value={searchText()}
          onInput={(e) => setSearchText(e.currentTarget.value)}
          class="flex-1 px-3 py-1.5 text-sm rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 focus:outline-none focus:border-indigo-500"
        />
        <StatusFilter selected={selectedStatuses()} onChange={setSelectedStatuses} />
      </div>

      {/* Command list */}
      <Show when={filteredCommands().length === 0}>
        <p class="text-center text-neutral-400 py-8">No commands to display.</p>
      </Show>

      <div class="space-y-2">
        <For each={filteredCommands()}>
          {(cmd) => (
            <CommandItem
              command={cmd}
              expanded={expandedId() === cmd.commandId}
              onToggle={() => toggleExpanded(cmd.commandId)}
            />
          )}
        </For>
      </div>
    </PageShell>
  )
}
