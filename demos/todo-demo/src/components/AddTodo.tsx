import { createSignal } from 'solid-js'
import { useClient } from '../bootstrap/cqrs-context'

interface AddTodoProps {
  onError: (message: string | undefined) => void
  formRef?: (el: HTMLFormElement) => void
}

type EditState = 'editing' | 'saving'

export default function AddTodo(props: AddTodoProps) {
  const client = useClient()
  const [content, setContent] = createSignal('')
  const [editState, setEditState] = createSignal<EditState>('editing')
  let formEl: HTMLFormElement | undefined
  let inputRef: HTMLInputElement | undefined

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (editState() !== 'editing') return
    const text = content().trim()
    if (text.length === 0) return

    props.onError(undefined)
    setEditState('saving')

    const result = await client.submit({
      type: 'CreateTodo',
      payload: { content: text },
    })

    if (result.ok) {
      setContent('')
    } else {
      props.onError(result.error.details?.errors[0]?.message ?? 'Command failed')
    }
    setEditState('editing')
  }

  function handleInputKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      formEl?.dispatchEvent(
        new CustomEvent('navedit', { bubbles: true, detail: { direction: 'down' } }),
      )
    }
  }

  return (
    <form
      ref={(el: HTMLFormElement) => {
        formEl = el
        el.addEventListener('requestedit', () => inputRef?.focus())
        props.formRef?.(el)
      }}
      onSubmit={handleSubmit}
      class="flex gap-2 mb-6"
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="What needs to be done?"
        value={content()}
        disabled={editState() === 'saving'}
        onInput={(e) => setContent(e.currentTarget.value)}
        onKeyDown={handleInputKeyDown}
        class="flex-1 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="submit"
        disabled={editState() === 'saving'}
        class="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-sm cursor-pointer"
      >
        Add
      </button>
    </form>
  )
}
