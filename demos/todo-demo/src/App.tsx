import type { RouteSectionProps } from '@solidjs/router'
import { createSignal, For, onCleanup } from 'solid-js'
import { useClient } from './bootstrap/cqrs-context'

export default function App(props: RouteSectionProps) {
  const client = useClient()

  const [wsConnection, setWsConnection] = createSignal('disconnected')
  const [wsTopics, setWsTopics] = createSignal<readonly string[]>([])

  const sub = client.syncManager.connectivity.state.subscribe((state) => {
    setWsConnection(state.wsConnection)
    setWsTopics(state.wsTopics)
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
