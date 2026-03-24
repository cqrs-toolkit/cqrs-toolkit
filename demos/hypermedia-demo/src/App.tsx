import { useClient } from '@cqrs-toolkit/client-solid'
import type { RouteSectionProps } from '@solidjs/router'
import { createSignal, For, onCleanup } from 'solid-js'

export default function App(props: RouteSectionProps) {
  const client = useClient()

  const [wsConnection, setWsConnection] = createSignal('disconnected')
  const [wsTopics, setWsTopics] = createSignal<readonly string[]>([])

  const sub = client.events$.subscribe((event) => {
    switch (event.type) {
      case 'ws:connecting':
        setWsConnection('connecting')
        break
      case 'ws:connected':
        setWsConnection('connected')
        break
      case 'ws:disconnected':
        setWsConnection('disconnected')
        setWsTopics([])
        break
      case 'ws:subscribed': {
        const data = event.data as { topics: readonly string[] }
        setWsTopics((prev) => Array.from(new Set([...prev, ...data.topics])))
        break
      }
    }
  })
  onCleanup(() => sub.unsubscribe())

  return (
    <>
      <div
        class="ws-debug"
        classList={{
          'ws-connecting': wsConnection() === 'connecting',
          'ws-connected': wsConnection() === 'connected',
          'ws-subscribed': wsTopics().length > 0,
        }}
        aria-hidden="true"
      >
        <For each={wsTopics()}>{(topic) => <span class={`ws-topic-${topic}`} />}</For>
      </div>
      {props.children}
    </>
  )
}
