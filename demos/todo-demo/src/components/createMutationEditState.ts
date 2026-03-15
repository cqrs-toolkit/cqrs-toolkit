import { createSignal } from 'solid-js'

type EditState = 'viewing' | 'editing'
type BaseMutationState = 'idle' | 'saving-edit' | 'deleting'

export function createMutationEditState<TExtra extends string = never>() {
  type MutationState = BaseMutationState | TExtra

  const [editState, setEditState] = createSignal<EditState>('viewing')
  const [mutation, setMutation] = createSignal<MutationState>('idle' as MutationState)

  const isMutating = () => mutation() !== 'idle'

  return {
    editState,
    mutation,
    setEditState,
    setMutation,
    isMutating,
    canEdit: () => !isMutating() && editState() === 'viewing',
    canSave: () => !isMutating() && editState() === 'editing',
    canDelete: () => !isMutating(),
  }
}
