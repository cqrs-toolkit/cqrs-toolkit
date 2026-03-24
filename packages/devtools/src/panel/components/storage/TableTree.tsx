import type { Component } from 'solid-js'
import { createEffect, createMemo, For } from 'solid-js'
import type { StorageStore } from '../../stores/storage.js'
import type { TreeNodeDef } from '../../stores/tree.js'
import { TreeNode } from './TreeNode.js'
import { TreeView } from './TreeView.js'

interface TableTreeProps {
  store: StorageStore
  onOpenTable: (table: string) => void
  onOpenDdl: (table: string) => void
}

export const TableTree: Component<TableTreeProps> = (props) => {
  const treeDefs = createMemo((): TreeNodeDef[] =>
    props.store.tables().map((table) => ({
      id: table.name,
      label: table.name,
      onActivate: () => props.onOpenTable(table.name),
      children: [
        {
          id: `${table.name}:schema`,
          label: 'Schema',
          onActivate: () => props.onOpenDdl(table.name),
        },
      ],
    })),
  )

  createEffect(() => {
    props.store.treeStore.setNodes(treeDefs())
  })

  return (
    <div class="storage-tree">
      <div class="storage-tree-header">Tables</div>
      <TreeView store={props.store.treeStore}>
        <For each={treeDefs()}>{(node) => <TreeNode node={node} depth={0} />}</For>
      </TreeView>
    </div>
  )
}
