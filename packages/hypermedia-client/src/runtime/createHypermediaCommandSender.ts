/**
 * Auto-wired ICommandSender backed by the commands.json manifest.
 *
 * Resolves command routing from the manifest, expands URI templates,
 * formats the wire body, and sends the HTTP request.
 */

import type { CommandRecord, ICommandSender } from '@cqrs-toolkit/client'
import { CommandSendError } from '@cqrs-toolkit/client'
import type { CommandManifest, CommandRouting, HypermediaCommandSenderOptions } from './types.js'

/**
 * Create an `ICommandSender` that auto-wires HTTP requests from a `commands.json` manifest.
 *
 * ```ts
 * import manifest from './.cqrs/commands.json'
 * const sender = createHypermediaCommandSender(manifest, { baseUrl: 'http://localhost:3000' })
 * ```
 */
export function createHypermediaCommandSender(
  manifest: CommandManifest,
  options: HypermediaCommandSenderOptions,
): ICommandSender {
  const doFetch = options.fetch ?? globalThis.fetch

  const sender: ICommandSender = {
    async send(command) {
      const routing = manifest.commands[command.type]
      if (!routing) {
        throw new CommandSendError(
          `No routing found for command type '${command.type}'`,
          'UNKNOWN_COMMAND',
          false,
        )
      }

      const url = expandTemplate(options.baseUrl, routing, command.path)
      const body = formatBody(routing, command)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Profile': routing.urn,
        'x-command-id': command.commandId,
      }

      const res = await doFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        credentials: 'include',
      })

      if (!res.ok) {
        const isRetryable = res.status >= 500 || res.status === 429
        const details = await safeParseJson(res)
        throw new CommandSendError(
          `Command ${command.type} failed: ${res.status}`,
          String(res.status),
          isRetryable,
          details,
        )
      }

      return res.json()
    },
  }
  return sender
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Expand a URI template using path values for variable substitution.
 */
function expandTemplate(baseUrl: string, routing: CommandRouting, path: unknown): string {
  let result = routing.template
  const record = (path ?? {}) as Record<string, unknown>
  for (const mapping of routing.mappings) {
    const value = record[mapping.variable]
    if (value === undefined && mapping.required) {
      throw new CommandSendError(
        `Missing required path variable '${mapping.variable}' for command template '${routing.template}'`,
        'MISSING_TEMPLATE_VAR',
        false,
      )
    }
    if (value !== undefined) {
      result = result.replace(`{${mapping.variable}}`, String(value))
    }
  }
  return `${baseUrl}${result}`
}

/**
 * Format the request body based on dispatch type.
 *
 * - `create`: body is `command.data` directly
 * - `command` / other: body is an envelope `{ type, data, revision }`
 */
function formatBody<TData>(routing: CommandRouting, command: CommandRecord<TData>): unknown {
  if (routing.dispatch === 'create') {
    return command.data
  }

  const envelope: Record<string, unknown> = {
    type: routing.commandType ?? command.type,
    data: command.data,
  }

  if (command.revision !== undefined) {
    envelope['revision'] = command.revision
  }

  return envelope
}

async function safeParseJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (text.length === 0) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}
