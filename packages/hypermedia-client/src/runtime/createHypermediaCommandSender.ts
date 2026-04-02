/**
 * Auto-wired ICommandSender backed by the commands.json manifest.
 *
 * Resolves command routing from the manifest, expands URI templates,
 * formats the wire body, and sends the HTTP request.
 */

import {
  CommandSendException,
  EnqueueCommand,
  ICommandSender,
  type CommandRecord,
} from '@cqrs-toolkit/client'
import { Err, Ok, type Link, type Result } from '@meticoeus/ddd-es'
import { createPresignedUploadHandler } from './presignedUpload.js'
import type {
  AfterSendHandler,
  CommandManifest,
  CommandRouting,
  HypermediaCommandSenderOptions,
} from './types.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BUILTIN_WORKFLOW_HANDLERS: Record<string, AfterSendHandler<any, any>> = {
  'svc:PresignedPostUpload': createPresignedUploadHandler(),
}

/**
 * Create an `ICommandSender` that auto-wires HTTP requests from a `commands.json` manifest.
 *
 * ```ts
 * import manifest from './.cqrs/commands.json'
 * const sender = createHypermediaCommandSender(manifest, { baseUrl: 'http://localhost:3000' })
 * ```
 */
export function createHypermediaCommandSender<TLink extends Link, TCommand extends EnqueueCommand>(
  manifest: CommandManifest,
  options: HypermediaCommandSenderOptions<TLink, TCommand>,
): ICommandSender<TLink, TCommand> {
  const doFetch = options.fetch ?? globalThis.fetch

  const sender: ICommandSender<TLink, TCommand> = {
    async send(command) {
      const routing = manifest.commands[command.type]
      if (!routing) {
        return Err(
          new CommandSendException(
            `No routing found for command type '${command.type}'`,
            'UNKNOWN_COMMAND',
            false,
          ),
        )
      }

      const urlResult = expandTemplate(options.baseUrl, routing, command.path)
      if (!urlResult.ok) return urlResult

      const requestBody = formatBody(routing, command)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Profile': routing.urn,
        'x-command-id': command.commandId,
        'x-request-id': crypto.randomUUID(),
      }

      let res: Response
      try {
        res = await doFetch(urlResult.value, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          credentials: 'include',
        })
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
        const isRetryable = res.status >= 500 || res.status === 429
        const details = await safeParseJson(res)
        return Err(
          new CommandSendException(
            `Command ${command.type} failed: ${res.status}`,
            String(res.status),
            isRetryable,
            details,
          ),
        )
      }

      const responseBody = await res.json()

      const afterSend = options.afterSend?.[command.type]
      if (afterSend) {
        return afterSend(command, responseBody, res)
      }

      // Auto-wire known workflow handlers from routing manifest
      if (routing.workflow) {
        const workflowHandler = BUILTIN_WORKFLOW_HANDLERS[routing.workflow.type]
        if (workflowHandler) {
          return workflowHandler(command, responseBody, res)
        }
      }

      return Ok(responseBody)
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
function expandTemplate(
  baseUrl: string,
  routing: CommandRouting,
  path: unknown,
): Result<string, CommandSendException> {
  let result = routing.template
  const record = (path ?? {}) as Record<string, unknown>
  for (const mapping of routing.mappings) {
    const value = record[mapping.variable]
    if (value === undefined && mapping.required) {
      return Err(
        new CommandSendException(
          `Missing required path variable '${mapping.variable}' for command template '${routing.template}'`,
          'MISSING_TEMPLATE_VAR',
          false,
        ),
      )
    }
    if (value !== undefined) {
      result = result.replace(`{${mapping.variable}}`, String(value))
    }
  }
  return Ok(`${baseUrl}${result}`)
}

/**
 * Format the request body based on dispatch type.
 *
 * - `create`: body is `command.data` directly
 * - `command` / other: body is an envelope `{ type, data, revision }`
 */
function formatBody<TLink extends Link, TCommand extends EnqueueCommand>(
  routing: CommandRouting,
  command: CommandRecord<TLink, TCommand>,
): unknown {
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
