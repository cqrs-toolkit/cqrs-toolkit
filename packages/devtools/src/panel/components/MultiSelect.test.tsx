import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { MultiSelect } from './MultiSelect.js'

const ALL_VALUES = Array.from({ length: 15 }, (_, i) => `Type-${String(i + 1).padStart(2, '0')}`)

describe('MultiSelect', () => {
  afterEach(cleanup)

  describe('filter does not affect actions', () => {
    it('selectAll selects all 15 items when filter hides some', () => {
      const { selected, openDropdown, typeInFilter, getCheckboxes, clickAll } = renderMultiSelect()
      openDropdown()
      typeInFilter('Type-0')

      // Only 9 items visible (Type-01 through Type-09), 6 hidden
      expect(getCheckboxes()).toHaveLength(9)

      clickAll()

      expect(selected().size).toBe(15)
      for (const v of ALL_VALUES) {
        expect(selected().has(v)).toBe(true)
      }
    })

    it('clear deselects all items when filter hides some', () => {
      const { selected, openDropdown, typeInFilter, getCheckboxes, clickNone } = renderMultiSelect(
        new Set(ALL_VALUES),
      )
      openDropdown()
      typeInFilter('Type-0')

      expect(getCheckboxes()).toHaveLength(9)

      clickNone()

      expect(selected().size).toBe(0)
    })
  })

  describe('filter does not affect toggle', () => {
    it('toggle selects an item while filter hides others', () => {
      const { selected, openDropdown, typeInFilter, getCheckboxes } = renderMultiSelect()
      openDropdown()
      typeInFilter('Type-0')

      const checkboxes = getCheckboxes()
      const type05Checkbox = checkboxes.find((cb) => cb.closest('label')?.textContent === 'Type-05')
      expect(type05Checkbox).toBeDefined()
      fireEvent.click(type05Checkbox!)

      expect(selected().size).toBe(1)
      expect(selected().has('Type-05')).toBe(true)
    })

    it('toggle deselects an item while filter hides others', () => {
      const { selected, openDropdown, typeInFilter, getCheckboxes } = renderMultiSelect(
        new Set(ALL_VALUES),
      )
      openDropdown()
      typeInFilter('Type-0')

      const checkboxes = getCheckboxes()
      const type05Checkbox = checkboxes.find((cb) => cb.closest('label')?.textContent === 'Type-05')
      expect(type05Checkbox).toBeDefined()
      fireEvent.click(type05Checkbox!)

      expect(selected().size).toBe(14)
      expect(selected().has('Type-05')).toBe(false)
    })
  })
})

function renderMultiSelect(initialSelected: Set<string> = new Set()) {
  const [selected, setSelected] = createSignal(initialSelected)

  const result = render(() => (
    <MultiSelect
      label="Type"
      values={ALL_VALUES}
      selected={selected()}
      onToggle={(v) => {
        setSelected((prev) => {
          const next = new Set(prev)
          if (next.has(v)) {
            next.delete(v)
          } else {
            next.add(v)
          }
          return next
        })
      }}
      onSelectAll={() => setSelected(new Set(ALL_VALUES))}
      onClear={() => setSelected(new Set())}
    />
  ))

  function openDropdown(): void {
    fireEvent.click(result.getByText('Type'))
  }

  function typeInFilter(text: string): void {
    fireEvent.input(result.getByPlaceholderText('Filter...'), { target: { value: text } })
  }

  function clickAll(): void {
    fireEvent.click(result.getByText('All'))
  }

  function clickNone(): void {
    fireEvent.click(result.getByText('None'))
  }

  function getCheckboxes(): HTMLInputElement[] {
    return result.getAllByRole('checkbox') as HTMLInputElement[]
  }

  return { selected, openDropdown, typeInFilter, clickAll, clickNone, getCheckboxes }
}
