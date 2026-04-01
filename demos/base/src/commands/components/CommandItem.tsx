import type { CommandRecord, CommandStatus, EnqueueCommand } from '@cqrs-toolkit/client'
import { ServiceLink } from '@meticoeus/ddd-es'
import { Show } from 'solid-js'

const STATUS_BADGE_CLASSES: Record<CommandStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  blocked: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  sending: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  succeeded: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  cancelled: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400',
}

interface CommandItemProps {
  command: CommandRecord<ServiceLink, EnqueueCommand>
  expanded: boolean
  onToggle: () => void
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}

export function CommandItem(props: CommandItemProps) {
  const cmd = () => props.command

  return (
    <div
      class={`command-item command-${cmd().status} rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden`}
    >
      {/* Collapsed row */}
      <button
        class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-750 cursor-pointer text-sm"
        onClick={props.onToggle}
      >
        <span
          class={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE_CLASSES[cmd().status]}`}
        >
          {cmd().status}
        </span>
        <span class="command-type font-medium truncate">{cmd().type}</span>
        <span class="text-neutral-400 font-mono text-xs">{cmd().commandId.slice(0, 8)}</span>
        <span class="ml-auto text-neutral-400 text-xs whitespace-nowrap">
          {formatTimestamp(cmd().createdAt)}
        </span>
      </button>

      {/* Expanded detail panel */}
      <Show when={props.expanded}>
        <div class="px-3 py-3 border-t border-neutral-100 dark:border-neutral-700 text-xs space-y-2">
          <DetailRow label="Command ID" value={cmd().commandId} mono />
          <DetailRow label="Service" value={cmd().service} />
          <DetailRow label="Attempts" value={String(cmd().attempts)} />

          <div>
            <span class="text-neutral-500 dark:text-neutral-400">Payload</span>
            <pre class="mt-0.5 p-2 rounded bg-neutral-50 dark:bg-neutral-900 overflow-x-auto text-xs">
              {JSON.stringify(cmd().data, null, 2)}
            </pre>
          </div>

          <Show when={cmd().error} keyed>
            {(error) => (
              <div>
                <span class="text-red-500">Error ({error.source})</span>
                <pre class="mt-0.5 p-2 rounded bg-red-50 dark:bg-red-950 overflow-x-auto text-xs text-red-700 dark:text-red-300">
                  {error.message}
                  {error.details ? `\n${JSON.stringify(error.details, null, 2)}` : ''}
                </pre>
              </div>
            )}
          </Show>

          <Show when={cmd().serverResponse !== undefined}>
            <div>
              <span class="text-neutral-500 dark:text-neutral-400">Server Response</span>
              <pre class="mt-0.5 p-2 rounded bg-neutral-50 dark:bg-neutral-900 overflow-x-auto text-xs">
                {JSON.stringify(cmd().serverResponse, null, 2)}
              </pre>
            </div>
          </Show>

          <Show when={cmd().dependsOn.length > 0}>
            <DetailRow label="Depends On" value={cmd().dependsOn.join(', ')} mono />
          </Show>

          <Show when={cmd().blockedBy.length > 0}>
            <DetailRow label="Blocked By" value={cmd().blockedBy.join(', ')} mono />
          </Show>

          <div class="flex gap-4 text-neutral-400">
            <span>Created: {new Date(cmd().createdAt).toLocaleString()}</span>
            <span>Updated: {new Date(cmd().updatedAt).toLocaleString()}</span>
          </div>
        </div>
      </Show>
    </div>
  )
}

function DetailRow(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div class="flex gap-2">
      <span class="text-neutral-500 dark:text-neutral-400">{props.label}:</span>
      <span class={props.mono ? 'font-mono' : ''}>{props.value}</span>
    </div>
  )
}
