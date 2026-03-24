import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { TreeNodeDef } from '../../stores/tree.js'
import { useTree } from './TreeView.js'

interface TreeNodeProps {
  node: TreeNodeDef
  depth: number
}

export const TreeNode: Component<TreeNodeProps> = (props) => {
  const tree = useTree()

  const hasChildren = () => (props.node.children?.length ?? 0) > 0
  const isSelected = () => tree.store.selectedNode() === props.node.id
  const isExpanded = () => tree.store.isExpanded(props.node.id)

  function handleClick(): void {
    if (isSelected()) {
      tree.store.selectNode(undefined)
    } else {
      tree.store.selectNode(props.node.id)
    }
    tree.focusContainer()
  }

  function handleArrowClick(e: MouseEvent): void {
    e.stopPropagation()
    tree.store.toggleExpanded(props.node.id)
    tree.focusContainer()
  }

  function handleDblClick(): void {
    tree.store.activateNode(props.node.id)
  }

  const indent = () => props.depth * 14

  return (
    <>
      <div
        class={`tree-node-row ${isSelected() ? 'selected' : ''}`}
        data-tree-node-id={props.node.id}
        style={{ 'padding-left': `${indent() + 4}px` }}
        onClick={handleClick}
        onDblClick={handleDblClick}
      >
        <Show when={hasChildren()} fallback={<span class="tree-node-spacer" />}>
          <span class="tree-node-arrow" onClick={handleArrowClick}>
            {isExpanded() ? '\u25BE' : '\u25B8'}
          </span>
        </Show>
        <span class="tree-node-label">{props.node.label}</span>
      </div>
      <Show when={hasChildren() && isExpanded()}>
        <For each={props.node.children}>
          {(child) => <TreeNode node={child} depth={props.depth + 1} />}
        </For>
      </Show>
    </>
  )
}
