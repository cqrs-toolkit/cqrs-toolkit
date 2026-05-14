import type { CommandDependency } from '@cqrs-toolkit/client'
import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'

interface DependencyListProps {
  dependsOn: readonly CommandDependency[]
  blockedBy: readonly string[]
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
            <For each={props.dependsOn}>
              {(dep) => (
                <li title={`source: ${dep.source}`}>
                  {dep.commandId.slice(0, 8)}
                  <span class="dep-source"> · {dep.source}</span>
                </li>
              )}
            </For>
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
