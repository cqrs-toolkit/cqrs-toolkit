/**
 * Presigned upload workflow handler.
 *
 * Implements the svc:PresignedPostUpload convention:
 * 1. Command response contains a presigned permit with upload URL and form fields
 * 2. Client POSTs multipart/form-data directly to the external upload URL
 * 3. Form fields from the permit appear before the file field (S3 ordering requirement)
 * 4. No Authorization header — the presigned URL is self-authorizing
 */

import { CommandSendException, type EnqueueCommand } from '@cqrs-toolkit/client'
import { Err, Ok, type Link } from '@meticoeus/ddd-es'
import type { AfterSendHandler } from './types.js'

export interface PresignedPermit {
  id: string
  data: {
    uploadForm: {
      url: string
      fields: Record<string, string>
    }
  }
}

export function isPresignedPermit(value: unknown): value is PresignedPermit {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string') return false
  if (typeof v.data !== 'object' || v.data === null) return false
  const data = v.data as Record<string, unknown>
  if (typeof data.uploadForm !== 'object' || data.uploadForm === null) return false
  const form = data.uploadForm as Record<string, unknown>
  return typeof form.url === 'string' && typeof form.fields === 'object' && form.fields !== null
}

export function createPresignedUploadHandler<
  TLink extends Link,
  TCommand extends EnqueueCommand,
>(): AfterSendHandler<TLink, TCommand> {
  return async (command, body) => {
    if (!isPresignedPermit(body)) {
      return Err(
        new CommandSendException(
          'Invalid presigned permit response',
          'INVALID_RESPONSE',
          false,
          body,
        ),
      )
    }

    const file = command.fileRefs?.[0]
    if (!file?.data) {
      return Err(
        new CommandSendException(
          'Presigned upload command requires a file attachment',
          'MISSING_FILE',
          false,
        ),
      )
    }

    const { uploadForm } = body.data
    const form = new FormData()

    // Fields must precede file in multipart body (S3 enforces this)
    for (const [key, value] of Object.entries(uploadForm.fields)) {
      form.append(key, String(value))
    }
    form.append('file', file.data, file.filename)

    let res: Response
    try {
      res = await fetch(uploadForm.url, { method: 'POST', body: form })
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
          `Presigned upload failed: ${res.status}`,
          String(res.status),
          res.status >= 500,
        ),
      )
    }

    return Ok(body)
  }
}
