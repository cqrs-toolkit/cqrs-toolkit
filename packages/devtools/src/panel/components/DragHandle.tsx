import type { Component } from 'solid-js'
import { onCleanup } from 'solid-js'

interface DragHandleProps {
  onDragStart?: () => void
  onDrag: (delta: number) => void
  onDragEnd?: () => void
}

export const DragHandle: Component<DragHandleProps> = (props) => {
  let cleanupDrag: (() => void) | undefined

  function handleMouseDown(e: MouseEvent): void {
    e.preventDefault()
    const startX = e.clientX
    document.body.style.userSelect = 'none'
    props.onDragStart?.()

    function handleMouseMove(moveEvent: MouseEvent): void {
      props.onDrag(startX - moveEvent.clientX)
    }

    function handleMouseUp(): void {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      cleanupDrag = undefined
      props.onDragEnd?.()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    cleanupDrag = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
    }
  }

  onCleanup(() => cleanupDrag?.())

  return <div class="drag-handle" onMouseDown={handleMouseDown} />
}
