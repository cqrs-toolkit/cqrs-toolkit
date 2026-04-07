/**
 * Consumer-facing config types and helpers for `cqrs-hypermedia.config.ts`.
 */

import type { JSONSchema7 } from 'json-schema'

/**
 * Schema handling mode.
 *
 * - `'bundled'` — schemas downloaded at generate time, embedded in generated output
 * - `'live'` — schemas fetched at runtime from the server, cached in browser cache
 */
export type SchemaMode = 'bundled' | 'live'

/**
 * Envelope extraction callback.
 *
 * Given a command's JSON schema (which may be an HTTP envelope wrapping the data
 * in a `$ref`), returns the `$id` URL of the actual data schema to use for
 * client-side validation. Return `undefined` to use the schema as-is.
 */
export type EnvelopeExtractor = (schema: JSONSchema7) => string | undefined

/**
 * Command entry — either a plain URN string or an object with per-command overrides.
 */
export type CommandEntry =
  | string
  | {
      urn: string
      extractEnvelope?: EnvelopeExtractor
    }

/**
 * Configuration for `cqrs-toolkit client` commands.
 */
export interface PullConfig {
  /** Base server URL (e.g. 'http://localhost:3002') */
  server: string
  /** Path to the served apidoc.jsonld (e.g. '/api/meta/apidoc') */
  apidocPath: string
  /** Output directory for generated files (default: '.cqrs') */
  outputDir?: string
  /** Schema handling mode (default: 'bundled') */
  schemas?: SchemaMode
  /**
   * Extract data schema `$id` from a create-surface schema.
   * Default: use schema as-is (create schemas are typically data-only).
   */
  extractCreate?: EnvelopeExtractor
  /**
   * Extract data schema `$id` from a command-surface envelope schema.
   * For the standard hypermedia envelope `{ type, data: { $ref }, revision }`,
   * return the `$ref` URL to use the referenced data schema for validation.
   */
  extractCommand?: EnvelopeExtractor
  /** Command URNs to pull, with optional per-command envelope extraction override. */
  commands: CommandEntry[]
  /** Representation @id fragments (e.g. ['#demo-todo-v1_0_0']) */
  representations: string[]
}
