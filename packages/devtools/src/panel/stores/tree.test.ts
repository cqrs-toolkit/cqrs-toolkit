import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { createTreeStore } from './tree.js'

const TWO_TABLES = [
  { id: 'table-a', label: 'table-a', children: [{ id: 'table-a:schema', label: 'Schema' }] },
  { id: 'table-b', label: 'table-b', children: [{ id: 'table-b:schema', label: 'Schema' }] },
]

describe('TreeStore', () => {
  describe('visibleList', () => {
    it('contains only roots when nothing is expanded', () => {
      createRoot((dispose) => {
        const store = createTreeStore()
        store.setNodes(TWO_TABLES)

        expect(store.visibleList()).toEqual(['table-a', 'table-b'])
        dispose()
      })
    })

    it('includes children when parent is expanded', () => {
      createRoot((dispose) => {
        const store = createTreeStore()
        store.setNodes(TWO_TABLES)
        store.expandNode('table-a')

        expect(store.visibleList()).toEqual(['table-a', 'table-a:schema', 'table-b'])
        dispose()
      })
    })

    it('collapsing removes children from list', () => {
      createRoot((dispose) => {
        const store = createTreeStore()
        store.setNodes(TWO_TABLES)

        store.expandNode('table-a')
        expect(store.visibleList()).toEqual(['table-a', 'table-a:schema', 'table-b'])

        store.collapseNode('table-a')
        expect(store.visibleList()).toEqual(['table-a', 'table-b'])
        dispose()
      })
    })
  })

  describe('keyboard navigation helpers', () => {
    it('getParentId returns parent for child nodes', () => {
      createRoot((dispose) => {
        const store = createTreeStore()
        store.setNodes(TWO_TABLES)

        expect(store.getParentId('table-a:schema')).toBe('table-a')
        expect(store.getParentId('table-a')).toBeUndefined()
        dispose()
      })
    })

    it('hasChildren returns true for nodes with children', () => {
      createRoot((dispose) => {
        const store = createTreeStore()
        store.setNodes(TWO_TABLES)

        expect(store.hasChildren('table-a')).toBe(true)
        expect(store.hasChildren('table-a:schema')).toBe(false)
        dispose()
      })
    })
  })

  describe('selection', () => {
    it('selectNode sets both selectedNode and lastSelectedNode', () => {
      createRoot((dispose) => {
        const store = createTreeStore()
        store.setNodes(TWO_TABLES)

        store.selectNode('table-a')
        expect(store.selectedNode()).toBe('table-a')
        expect(store.lastSelectedNode()).toBe('table-a')
        dispose()
      })
    })

    it('clearSelection clears selectedNode but preserves lastSelectedNode', () => {
      createRoot((dispose) => {
        const store = createTreeStore()
        store.setNodes(TWO_TABLES)

        store.selectNode('table-a')
        store.clearSelection()
        expect(store.selectedNode()).toBeUndefined()
        expect(store.lastSelectedNode()).toBe('table-a')
        dispose()
      })
    })
  })

  describe('reconcile', () => {
    it('drops expanded state for removed tables', () => {
      createRoot((dispose) => {
        const store = createTreeStore()
        store.setNodes(TWO_TABLES)
        store.expandNode('table-a')
        store.expandNode('table-b')

        store.reconcile(['table-b'])
        expect(store.isExpanded('table-a')).toBe(false)
        expect(store.isExpanded('table-b')).toBe(true)
        dispose()
      })
    })

    it('clears selection for removed tables', () => {
      createRoot((dispose) => {
        const store = createTreeStore()
        store.setNodes(TWO_TABLES)
        store.selectNode('table-a:schema')

        store.reconcile(['table-b'])
        expect(store.selectedNode()).toBeUndefined()
        expect(store.lastSelectedNode()).toBeUndefined()
        dispose()
      })
    })
  })
})
