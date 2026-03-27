import { CommandSendError, ICommandSender } from '@cqrs-toolkit/client'
import { ServiceLink } from '@meticoeus/ddd-es'
import { notebookCommandEndpoints } from '../domain/notebooks/processor.js'
import { noteCommandEndpoints } from '../domain/notes/processor.js'
import { todoCommandEndpoints } from '../domain/todos/processor.js'

const commandEndpoints: Record<string, string> = {
  ...todoCommandEndpoints,
  ...noteCommandEndpoints,
  ...notebookCommandEndpoints,
}

export const commandSender: ICommandSender<ServiceLink> = {
  async send(command) {
    const endpoint = commandEndpoints[command.type]
    if (typeof endpoint !== 'string') {
      throw new CommandSendError(`Unknown command type: ${command.type}`, '400', false)
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-command-id': command.commandId,
      },
      body: JSON.stringify({ type: command.type, data: command.data, revision: command.revision }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: `Command failed: ${res.status}` }))
      throw new CommandSendError(
        body.message ?? `Command failed: ${res.status}`,
        String(res.status),
        res.status >= 500,
        body.details,
      )
    }

    return res.json()
  },
}
