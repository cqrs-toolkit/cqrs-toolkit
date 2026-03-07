import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js'

export function useContainerWidth(ref: Accessor<HTMLElement | undefined>): Accessor<number> {
  const [width, setWidth] = createSignal(0)

  const observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) {
      setWidth(entry.contentRect.width)
    }
  })

  createEffect(() => {
    const el = ref()
    if (el) {
      observer.observe(el)
    }
  })

  onCleanup(() => observer.disconnect())

  return width
}
