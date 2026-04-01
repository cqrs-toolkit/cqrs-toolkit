/**
 * FileObject command helpers — permit response type and upload handler.
 */

import { CommandSendException } from '@cqrs-toolkit/client'
import type { AfterSendHandler } from '@cqrs-toolkit/hypermedia-client'
import { Err, Ok, type ServiceLink } from '@meticoeus/ddd-es'
import { AppCommand } from '../../.cqrs/commands.js'

export interface UploadPermitResponse {
  id: string
  data: {
    uploadForm: {
      url: string
      fields: Record<string, string>
    }
  }
}

export function isUploadPermitResponse(value: unknown): value is UploadPermitResponse {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string') return false
  if (typeof v.data !== 'object' || v.data === null) return false
  const data = v.data as Record<string, unknown>
  if (typeof data.uploadForm !== 'object' || data.uploadForm === null) return false
  const form = data.uploadForm as Record<string, unknown>
  return typeof form.url === 'string' && typeof form.fields === 'object' && form.fields !== null
}

export const handleCreateFileObjectResponse: AfterSendHandler<ServiceLink, AppCommand> = async (
  command,
  body,
) => {
  if (!isUploadPermitResponse(body)) {
    return Err(new CommandSendException('Invalid permit response', 'INVALID_RESPONSE', false, body))
  }
  const file = command.fileRefs?.[0]
  if (!file?.data) {
    return Err(
      new CommandSendException(
        'CreateFileObject requires a file attachment',
        'MISSING_FILE',
        false,
      ),
    )
  }

  const { uploadForm } = body.data
  const form = new FormData()
  for (const [key, value] of Object.entries(uploadForm.fields)) {
    form.append(key, String(value))
  }
  form.append('file', file.data, file.filename)

  let res: Response
  try {
    res = await fetch(uploadForm.url, {
      method: 'POST',
      body: form,
    })
  } catch (err) {
    return Err(
      new CommandSendException(
        `Upload network error: ${err instanceof Error ? err.message : String(err)}`,
        'NETWORK',
        true,
      ),
    )
  }
  if (!res.ok) {
    return Err(
      new CommandSendException(
        `Upload failed: ${res.status}`,
        String(res.status),
        res.status >= 500,
      ),
    )
  }

  return Ok(body)
}
