/**
 * Domain-agnostic envelope types shared across domains.
 */

import type { ISerializedEvent } from '@meticoeus/ddd-es'

/**
 * Successful command response (2xx status).
 */
export interface CommandSuccessResponse {
  readonly id: string
  readonly nextExpectedRevision: string
  readonly events: ISerializedEvent[]
}

/**
 * Failed command response (4xx/5xx status).
 */
export interface CommandErrorResponse {
  readonly message: string
  readonly details?: unknown
}

/**
 * Union type for command responses.
 */
export type CommandResponse = CommandSuccessResponse | CommandErrorResponse
