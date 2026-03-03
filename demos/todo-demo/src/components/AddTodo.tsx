import { createSignal } from 'solid-js'
import { useClient } from '../cqrs-context'

interface AddTodoProps {
  onError: (message: string | null) => void
}

export default function AddTodo(props: AddTodoProps) {
  const { commandQueue } = useClient()
  const [content, setContent] = createSignal('')

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    const text = content().trim()
    if (text.length === 0) return

    props.onError(null)

    const result = await commandQueue.enqueueAndWait({
      type: 'CreateTodo',
      payload: { content: text },
    })

    if (result.ok) {
      setContent('')
    } else {
      props.onError(result.errors[0]?.message ?? 'Command failed')
    }
  }

  return (
    <form onSubmit={handleSubmit} class="flex gap-2 mb-6">
      <input
        type="text"
        placeholder="What needs to be done?"
        value={content()}
        onInput={(e) => setContent(e.currentTarget.value)}
        class="flex-1 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="submit"
        class="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-sm cursor-pointer"
      >
        Add
      </button>
    </form>
  )
}
