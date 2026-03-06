import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import type { ConnectionState } from '../stores/connection.js'

interface ConnectionBannerProps {
  state: ConnectionState
  role: 'leader' | 'standby' | undefined
}

export const ConnectionBanner: Component<ConnectionBannerProps> = (props) => {
  return (
    <>
      <Show when={props.state === 'disconnected'}>
        <div class="banner banner-error">Disconnected from extension background</div>
      </Show>

      <Show when={props.state === 'waiting'}>
        <div class="banner banner-warning">
          Waiting for CQRS Toolkit client (ensure debug: true is enabled)
        </div>
      </Show>

      <Show when={props.state === 'connected' && props.role === 'standby'}>
        <div class="banner banner-info">Connected as standby tab — another tab is the leader</div>
      </Show>
    </>
  )
}
