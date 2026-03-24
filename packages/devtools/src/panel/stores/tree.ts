/**
 * Tree store — manages selection, expansion, and keyboard navigation state
 * for a tree view component.
 *
 * The tree structure is passed in as data — no dynamic registration.
 */

import { createMemo, createSignal } from 'solid-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TreeNodeDef {
  id: string
  label: string
  onActivate?: () => void
  children?: TreeNodeDef[]
}

export interface TreeStore {
  // Data
  setNodes: (nodes: TreeNodeDef[]) => void

  // Selection
  selectedNode: () => string | undefined
  lastSelectedNode: () => string | undefined
  selectNode: (id: string | undefined) => void
  clearSelection: () => void

  // Expansion
  isExpanded: (id: string) => boolean
  toggleExpanded: (id: string) => void
  expandNode: (id: string) => void
  collapseNode: (id: string) => void

  // Derived
  visibleList: () => string[]
  activateNode: (id: string) => void
  getParentId: (id: string) => string | undefined
  hasChildren: (id: string) => boolean

  // Reconciliation
  reconcile: (validRootIds: string[]) => void
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTreeStore(): TreeStore {
  const [nodes, setNodes] = createSignal<TreeNodeDef[]>([])
  const [selectedNode, setSelectedNode] = createSignal<string | undefined>()
  const [lastSelectedNode, setLastSelectedNode] = createSignal<string | undefined>()
  const [expandedNodes, setExpandedNodes] = createSignal<Set<string>>(new Set())

  const parentMap = createMemo(() => {
    const map = new Map<string, string | undefined>()
    function walk(defs: TreeNodeDef[], parentId: string | undefined): void {
      for (const def of defs) {
        map.set(def.id, parentId)
        if (def.children) {
          walk(def.children, def.id)
        }
      }
    }
    walk(nodes(), undefined)
    return map
  })

  const childrenMap = createMemo(() => {
    const map = new Map<string, TreeNodeDef[]>()
    function walk(defs: TreeNodeDef[]): void {
      for (const def of defs) {
        if (def.children && def.children.length > 0) {
          map.set(def.id, def.children)
        }
        if (def.children) {
          walk(def.children)
        }
      }
    }
    walk(nodes())
    return map
  })

  // Visible list: walk the tree, only descending into expanded nodes
  const visibleList = createMemo(() => {
    const expanded = expandedNodes()
    const result: string[] = []

    function visit(defs: TreeNodeDef[]): void {
      for (const def of defs) {
        result.push(def.id)
        if (def.children && expanded.has(def.id)) {
          visit(def.children)
        }
      }
    }

    visit(nodes())
    return result
  })

  function selectNode(id: string | undefined): void {
    setSelectedNode(id)
    if (id !== undefined) {
      setLastSelectedNode(id)
    }
  }

  function clearSelection(): void {
    setSelectedNode(undefined)
  }

  function isExpanded(id: string): boolean {
    return expandedNodes().has(id)
  }

  function toggleExpanded(id: string): void {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function expandNode(id: string): void {
    setExpandedNodes((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  function collapseNode(id: string): void {
    setExpandedNodes((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function getParentId(id: string): string | undefined {
    return parentMap().get(id)
  }

  function hasChildren(id: string): boolean {
    return childrenMap().has(id)
  }

  function reconcile(validRootIds: string[]): void {
    const validSet = new Set(validRootIds)

    setExpandedNodes((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const id of prev) {
        const rootId = id.includes(':') ? id.slice(0, id.indexOf(':')) : id
        if (!validSet.has(rootId)) {
          next.delete(id)
          changed = true
        }
      }
      return changed ? next : prev
    })

    const selected = selectedNode()
    if (selected !== undefined) {
      const rootId = selected.includes(':') ? selected.slice(0, selected.indexOf(':')) : selected
      if (!validSet.has(rootId)) {
        setSelectedNode(undefined)
      }
    }

    const last = lastSelectedNode()
    if (last !== undefined) {
      const rootId = last.includes(':') ? last.slice(0, last.indexOf(':')) : last
      if (!validSet.has(rootId)) {
        setLastSelectedNode(undefined)
      }
    }
  }

  function activateNode(id: string): void {
    function find(defs: TreeNodeDef[]): TreeNodeDef | undefined {
      for (const def of defs) {
        if (def.id === id) return def
        if (def.children) {
          const found = find(def.children)
          if (found) return found
        }
      }
      return undefined
    }
    find(nodes())?.onActivate?.()
  }

  return {
    setNodes,

    selectedNode,
    lastSelectedNode,
    selectNode,
    clearSelection,

    isExpanded,
    toggleExpanded,
    expandNode,
    collapseNode,

    visibleList,
    activateNode,
    getParentId,
    hasChildren,

    reconcile,
  }
}
