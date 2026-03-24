import type { Component, JSX } from 'solid-js'
import { createContext, useContext } from 'solid-js'
import type { TreeStore } from '../../stores/tree.js'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface TreeContext {
  store: TreeStore
  focusContainer: () => void
}

const TreeCtx = createContext<TreeContext>()

export function useTree(): TreeContext {
  const ctx = useContext(TreeCtx)
  if (!ctx) throw new Error('useTree must be used within a TreeView')
  return ctx
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TreeViewProps {
  store: TreeStore
  children?: JSX.Element
}

export const TreeView: Component<TreeViewProps> = (props) => {
  let containerRef: HTMLDivElement | undefined

  function focusContainer(): void {
    containerRef?.focus()
  }

  function handleFocus(): void {
    // Skip if a click handler already set the selection
    if (props.store.selectedNode() !== undefined) return

    // Restore last selected or select first visible
    const last = props.store.lastSelectedNode()
    if (last !== undefined) {
      const visible = props.store.visibleList()
      if (visible.includes(last)) {
        props.store.selectNode(last)
        return
      }
    }
    const first = props.store.visibleList()[0]
    if (first !== undefined) {
      props.store.selectNode(first)
    }
  }

  function handleBlur(e: FocusEvent): void {
    if (containerRef && !containerRef.contains(e.relatedTarget as Node)) {
      props.store.clearSelection()
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    const visible = props.store.visibleList()
    const selected = props.store.selectedNode()

    switch (e.key) {
      case 'ArrowUp': {
        e.preventDefault()
        if (selected === undefined) {
          const first = visible[0]
          if (first !== undefined) props.store.selectNode(first)
          return
        }
        const idx = visible.indexOf(selected)
        if (idx > 0) {
          const target = visible[idx - 1]!
          props.store.selectNode(target)
          scrollToNode(target)
        }
        return
      }

      case 'ArrowDown': {
        e.preventDefault()
        if (selected === undefined) {
          const first = visible[0]
          if (first !== undefined) props.store.selectNode(first)
          return
        }
        const idx = visible.indexOf(selected)
        if (idx >= 0 && idx < visible.length - 1) {
          const target = visible[idx + 1]!
          props.store.selectNode(target)
          scrollToNode(target)
        }
        return
      }

      case 'ArrowLeft': {
        e.preventDefault()
        if (selected === undefined) return

        if (props.store.isExpanded(selected)) {
          props.store.collapseNode(selected)
        } else {
          const parentId = props.store.getParentId(selected)
          if (parentId !== undefined) {
            props.store.selectNode(parentId)
            scrollToNode(parentId)
          }
        }
        return
      }

      case 'ArrowRight': {
        e.preventDefault()
        if (selected === undefined) return

        if (props.store.hasChildren(selected) && !props.store.isExpanded(selected)) {
          props.store.expandNode(selected)
        } else if (props.store.hasChildren(selected) && props.store.isExpanded(selected)) {
          // Next in visible list is always the first child when expanded
          const idx = visible.indexOf(selected)
          if (idx >= 0 && idx < visible.length - 1) {
            const target = visible[idx + 1]!
            props.store.selectNode(target)
            scrollToNode(target)
          }
        } else {
          // Leaf: same as Down
          const idx = visible.indexOf(selected)
          if (idx >= 0 && idx < visible.length - 1) {
            const target = visible[idx + 1]!
            props.store.selectNode(target)
            scrollToNode(target)
          }
        }
        return
      }

      case 'Home': {
        e.preventDefault()
        const first = visible[0]
        if (first !== undefined) {
          props.store.selectNode(first)
          scrollToNode(first)
        }
        return
      }

      case 'End': {
        e.preventDefault()
        const last = visible[visible.length - 1]
        if (last !== undefined) {
          props.store.selectNode(last)
          scrollToNode(last)
        }
        return
      }

      case 'Enter': {
        e.preventDefault()
        if (selected !== undefined) {
          props.store.activateNode(selected)
        }
        return
      }

      case 'Escape': {
        e.preventDefault()
        containerRef?.blur()
        return
      }
    }
  }

  function scrollToNode(id: string): void {
    const el = containerRef?.querySelector(`[data-tree-node-id="${CSS.escape(id)}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }

  const context: TreeContext = {
    store: props.store,
    focusContainer,
  }

  return (
    <TreeCtx.Provider value={context}>
      <div
        class="tree-view"
        ref={containerRef}
        tabindex="0"
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      >
        {props.children}
      </div>
    </TreeCtx.Provider>
  )
}
