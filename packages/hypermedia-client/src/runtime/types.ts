/**
 * Types for the commands.json manifest consumed at runtime.
 */

import type { CommandRecord, CommandSendException, EnqueueCommand } from '@cqrs-toolkit/client'
import type { Link, Result } from '@meticoeus/ddd-es'

/**
 * A single template variable mapping.
 */
export interface TemplateMapping {
  /** URL template variable name (e.g. 'id') */
  variable: string
  /** Whether the mapping is required */
  required: boolean
}

/**
 * Routing info for a single command, read from commands.json.
 */
export interface CommandRouting {
  /** Full command URN */
  urn: string
  /** Dispatch type ('create', 'command', or custom) */
  dispatch: string
  /** Command type discriminator for envelope-style endpoints */
  commandType?: string
  /** URI template (e.g. '/api/todos/{id}/command') */
  template: string
  /** Template variable mappings */
  mappings: TemplateMapping[]
}

/**
 * The commands.json manifest structure.
 */
export interface CommandManifest {
  commands: Record<string, CommandRouting>
}

/**
 * Hook called after a successful (2xx) command response, before `send()` returns.
 *
 * Registered per command type. Receives the command record, the parsed JSON body,
 * and the raw Response. Must return the final body to use as the command result.
 */
export type AfterSendHandler<TLink extends Link, TCommand extends EnqueueCommand> = (
  command: CommandRecord<TLink, TCommand>,
  body: unknown,
  response: Response,
) => Promise<Result<unknown, CommandSendException>>

/**
 * Options for creating a hypermedia command sender.
 */
export interface HypermediaCommandSenderOptions<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> {
  /** Base URL of the API server (e.g. 'http://localhost:3000') */
  baseUrl: string
  /** Optional fetch implementation (defaults to global fetch) */
  fetch?: typeof globalThis.fetch
  /** Per-command-type hooks called after a 2xx response, before send() returns. */
  afterSend?: Partial<Record<TCommand['type'], AfterSendHandler<TLink, TCommand>>>
}

// ---------------------------------------------------------------------------
// Representation types
// ---------------------------------------------------------------------------

/**
 * A single surface endpoint (collection, resource, or events).
 */
export interface SurfaceEndpoint {
  /** Non-templated base href (e.g. '/api/todos') */
  href?: string
  /** RFC 6570 URI template (e.g. '/api/todos/{id}/events{?afterRevision}') */
  template: string
}

/**
 * All surfaces for a single representation version.
 */
export interface RepresentationSurfaces {
  /** Semver version */
  version: string
  /** Collection surface */
  collection: SurfaceEndpoint
  /** Single resource surface */
  resource: SurfaceEndpoint
  /** Per-aggregate item events surface */
  itemEvents: SurfaceEndpoint
  /** Global aggregate events surface */
  aggregateEvents: SurfaceEndpoint
}

/**
 * All representations keyed by hydra:Class @id (e.g. 'demo:Todo').
 */
export type RepresentationManifest = Record<string, RepresentationSurfaces>
