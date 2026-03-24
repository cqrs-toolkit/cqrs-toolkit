import { useClient } from '@cqrs-toolkit/client-solid'
import { A } from '@solidjs/router'
import type { JSX } from 'solid-js'

interface PageShellProps {
  title: string
  children: JSX.Element
}

export default function PageShell(props: PageShellProps) {
  const client = useClient()

  return (
    <div class="max-w-xl mx-auto px-4 py-8">
      <A
        href="/"
        class="inline-block text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 mb-4"
      >
        &larr; Back
      </A>
      <h1 class="text-2xl font-bold mb-1">{props.title}</h1>
      <span class="mode-badge inline-block text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 mb-4">
        mode: {client.mode} | status: {client.status}
      </span>
      {props.children}
    </div>
  )
}
