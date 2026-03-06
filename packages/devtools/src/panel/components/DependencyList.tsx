import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'

interface DependencyListProps {
  dependsOn: string[]
  blockedBy: string[]
}

export const DependencyList: Component<DependencyListProps> = (props) => {
  const hasDeps = () => props.dependsOn.length > 0 || props.blockedBy.length > 0

  return (
    <Show when={hasDeps()}>
      <div class="detail-section">
        <h4>Dependencies</h4>
        <Show when={props.dependsOn.length > 0}>
          <span class="dep-label">Depends on</span>
          <ul class="dep-list">
            <For each={props.dependsOn}>{(id) => <li>{id.slice(0, 8)}</li>}</For>
          </ul>
        </Show>
        <Show when={props.blockedBy.length > 0}>
          <span class="dep-label">Blocked by</span>
          <ul class="dep-list">
            <For each={props.blockedBy}>{(id) => <li>{id.slice(0, 8)}</li>}</For>
          </ul>
        </Show>
      </div>
    </Show>
  )
}
