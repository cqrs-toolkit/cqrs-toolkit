import { createSignal } from 'solid-js'
import { useClient } from '../bootstrap/cqrs-context'

interface AddNoteProps {
  onError: (message: string | undefined) => void
  formRef?: (el: HTMLFormElement) => void
}

export default function AddNote(props: AddNoteProps) {
  const { commandQueue } = useClient()
  const [title, setTitle] = createSignal('')
  const [body, setBody] = createSignal('')
  let formEl: HTMLFormElement | undefined
  let titleInputRef: HTMLInputElement | undefined

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    const trimmedTitle = title().trim()
    if (trimmedTitle.length === 0) return

    props.onError(undefined)

    const result = await commandQueue.enqueueAndWait({
      type: 'CreateNote',
      payload: { title: trimmedTitle, body: body() },
    })

    if (result.ok) {
      setTitle('')
      setBody('')
    } else {
      props.onError(result.error.details?.errors[0]?.message ?? 'Command failed')
    }
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
      class="mb-6"
    >
      <div class="flex gap-2">
        <input
          ref={titleInputRef}
          type="text"
          placeholder="Note title"
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
          onKeyDown={handleTitleKeyDown}
          class="flex-1 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          class="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-sm cursor-pointer"
        >
          Add
        </button>
      </div>
      <textarea
        placeholder="Body (optional)"
        value={body()}
        onInput={(e) => setBody(e.currentTarget.value)}
        class="w-full mt-2 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
        rows={2}
      />
    </form>
  )
}
