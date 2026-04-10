import { appCreateListQuery, TrashIcon } from '#common/components'
import { AutoRevision, EntityId, entityIdMatches, SubmitResult } from '@cqrs-toolkit/client'
import { createEntityCacheKey, useClient } from '@cqrs-toolkit/client-solid'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { createMemo, For, Show } from 'solid-js'
import type { FileObject } from '../domain/index.js'
import { FILE_OBJECTS_COLLECTION_NAME } from '../domain/index.js'

interface AttachmentListProps {
  noteId: EntityId
  notebookId: EntityId
  onSubmitUpload: (params: { noteId: EntityId; file: File }) => Promise<SubmitResult<unknown>>
  onSubmitDelete: (params: {
    id: EntityId
    revision: AutoRevision
  }) => Promise<SubmitResult<unknown>>
}

export function AttachmentList(props: AttachmentListProps) {
  const client = useClient<ServiceLink>()
  const notebookCacheKey = createEntityCacheKey<ServiceLink>(
    { service: 'nb', type: 'Notebook' },
    () => props.notebookId,
  )

  const attachmentsQuery = appCreateListQuery<FileObject>(
    client.queryManager,
    FILE_OBJECTS_COLLECTION_NAME,
    notebookCacheKey,
  )

  const noteAttachments = createMemo(() =>
    attachmentsQuery.items.filter((f) => entityIdMatches(f.noteId, props.noteId)),
  )

  function handleFileInput(files: FileList | null) {
    if (!files) return
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file) {
        props.onSubmitUpload({ noteId: props.noteId, file })
      }
    }
  }

  async function handleDelete(attachment: FileObject) {
    await props.onSubmitDelete({
      id: attachment.id,
      revision: { __autoRevision: true, fallback: attachment.latestRevision },
    })
  }

  function handleDownload(attachment: FileObject) {
    const baseUrl = location.origin
    if (typeof attachment.id === 'string') {
      window.open(`${baseUrl}/api/file-objects/${attachment.id}/download`, '_blank')
    } else {
      // TODO: prompt local download
    }
  }

  return (
    <div class="attachment-list border-t border-neutral-200 dark:border-neutral-700 p-2">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs text-neutral-500 font-medium">Attachments</span>
        <label class="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
          + Add
          <input
            type="file"
            class="attachment-file-input hidden"
            multiple
            onChange={(e) => handleFileInput(e.currentTarget.files)}
          />
        </label>
      </div>

      <Show when={noteAttachments().length > 0}>
        <div class="flex flex-wrap gap-1">
          <For each={noteAttachments()}>
            {(attachment) => (
              <div class="attachment-item flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-xs">
                <button
                  class="attachment-name text-blue-600 hover:underline cursor-pointer"
                  onClick={() => handleDownload(attachment)}
                >
                  {attachment.name}
                </button>
                <button
                  class="delete-attachment text-red-400 hover:text-red-600 cursor-pointer"
                  onClick={() => handleDelete(attachment)}
                  title="Delete attachment"
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
