import { CommandSendException, EnqueueCommand, type ICommandSender } from '@cqrs-toolkit/client'
import { Err, Ok, type ServiceLink } from '@meticoeus/ddd-es'
import { fileObjectCommandEndpoints } from '../domain/file-objects/processor.js'
import { notebookCommandEndpoints } from '../domain/notebooks/processor.js'
import { noteCommandEndpoints } from '../domain/notes/processor.js'
import { todoCommandEndpoints } from '../domain/todos/processor.js'

const commandEndpoints: Record<string, string> = {
  ...todoCommandEndpoints,
  ...noteCommandEndpoints,
  ...notebookCommandEndpoints,
  ...fileObjectCommandEndpoints,
}

export const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
  async send(command) {
    const endpoint = commandEndpoints[command.type]
    if (typeof endpoint !== 'string') {
      return Err(new CommandSendException(`Unknown command type: ${command.type}`, '400', false))
    }

    const hasFiles = command.fileRefs && command.fileRefs.length > 0

    let res: Response
    try {
      res = hasFiles ? await sendMultipart(endpoint, command) : await sendJson(endpoint, command)
    } catch (err) {
      return Err(
        new CommandSendException(
          `Network error: ${err instanceof Error ? err.message : String(err)}`,
          'NETWORK',
          true,
        ),
      )
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: `Command failed: ${res.status}` }))
      return Err(
        new CommandSendException(
          body.message ?? `Command failed: ${res.status}`,
          String(res.status),
          res.status >= 500,
          body.details,
        ),
      )
    }

    return Ok(await res.json())
  },
}

function sendJson(
  endpoint: string,
  command: { commandId: string; type: string; data: unknown; revision?: unknown },
): Promise<Response> {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-command-id': command.commandId,
    },
    body: JSON.stringify({ type: command.type, data: command.data, revision: command.revision }),
  })
}

function sendMultipart(
  endpoint: string,
  command: {
    commandId: string
    type: string
    data: unknown
    fileRefs?: Array<{ filename: string; data?: Blob }>
  },
): Promise<Response> {
  const form = new FormData()
  const data = command.data as Record<string, unknown>
  for (const [key, value] of Object.entries(data)) {
    form.append(key, String(value))
  }
  const fileRef = command.fileRefs?.[0]
  if (fileRef?.data) {
    form.append('file', fileRef.data, fileRef.filename)
  }
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'x-command-id': command.commandId },
    body: form,
  })
}
