import type { SubmitResult } from '@cqrs-toolkit/client'
import { createSignal } from 'solid-js'

interface AddNoteProps {
  onSubmitCreate: (
    params: { title: string; body: string },
    options?: { commandId?: string },
  ) => Promise<SubmitResult<unknown>>
  onError: (message: string | undefined) => void
  formRef?: (el: HTMLFormElement) => void
}

type EditState = 'editing' | 'saving'

export function AddNote(props: AddNoteProps) {
  const [title, setTitle] = createSignal('')
  const [body, setBody] = createSignal('')
  const [editState, setEditState] = createSignal<EditState>('editing')
  let formEl: HTMLFormElement | undefined
  let titleInputRef: HTMLInputElement | undefined
  let pendingCommandId: string | undefined

  function handleInput() {
    pendingCommandId = undefined
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (editState() !== 'editing') return
    const trimmedTitle = title().trim()
    if (trimmedTitle.length === 0) return

    props.onError(undefined)
    setEditState('saving')

    const result = await props.onSubmitCreate(
      { title: trimmedTitle, body: body() },
      { commandId: pendingCommandId },
    )

    if (result.ok) {
      pendingCommandId = undefined
      setTitle('')
      setBody('')
    } else {
      props.onError(result.error.message)
    }
    setEditState('editing')
  }

  function handleTitleKeyDown(e: KeyboardEvent) {
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
        el.addEventListener('requestedit', () => titleInputRef?.focus())
        props.formRef?.(el)
      }}
      onSubmit={handleSubmit}
      class={`add-form mb-6 ${editState() === 'saving' ? 'add-saving' : 'add-idle'}`}
    >
      <div class="flex gap-2">
        <input
          ref={titleInputRef}
          type="text"
          placeholder="Note title"
          value={title()}
          disabled={editState() === 'saving'}
          onInput={(e) => {
            setTitle(e.currentTarget.value)
            handleInput()
          }}
          onKeyDown={handleTitleKeyDown}
          class="flex-1 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={editState() === 'saving'}
          class="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-sm cursor-pointer"
        >
          Add
        </button>
      </div>
      <textarea
        placeholder="Body (optional)"
        value={body()}
        disabled={editState() === 'saving'}
        onInput={(e) => {
          setBody(e.currentTarget.value)
          handleInput()
        }}
        class="w-full mt-2 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
        rows={2}
      />
    </form>
  )
}
