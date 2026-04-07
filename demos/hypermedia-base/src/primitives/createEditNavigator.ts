export function createEditNavigator() {
  let headerEl: HTMLElement | undefined
  let listEl: HTMLElement | undefined

  function handleNavEdit(e: Event) {
    const { direction } = (e as CustomEvent<{ direction: 'up' | 'down' }>).detail
    const source = (e.target as Element).closest('li')
    let target: Element | undefined

    if (source) {
      if (direction === 'down') {
        target = source.nextElementSibling ?? undefined
      } else {
        target = source.previousElementSibling ?? headerEl
      }
    } else if (direction === 'down') {
      target = listEl?.firstElementChild ?? undefined
    }

    if (target) {
      target.dispatchEvent(new CustomEvent('requestedit', { bubbles: false }))
    }
  }

  return {
    headerRef(el: HTMLElement) {
      headerEl = el
    },
    listRef(el: HTMLElement) {
      listEl = el
    },
    containerRef(el: HTMLElement) {
      el.addEventListener('navedit', handleNavEdit)
    },
  }
}
