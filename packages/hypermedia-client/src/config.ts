/**
 * Consumer-facing config types and helpers for `cqrs-hypermedia.config.ts`.
 */

import type { JSONPathExpression } from '@cqrs-toolkit/client'
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
 * Per-field annotation marking a property in a schema as an ID or a Link.
 *
 * Codegen replaces the field's generated type with `EntityId` (`kind: 'id'`)
 * or the configured `linkType` (`Link` / `ServiceLink`) plus an import.
 *
 * When `aggregateUrn` (or `aggregateUrns` for link kind) is supplied, the
 * entry also propagates to the generated representation manifest as a
 * `generatedIdReferences` row, where it can be resolved at runtime through
 * an `AggregateRegistry` into a {@link IdReference} for `createCollection`.
 * Entries without an aggregate are typing-only (e.g. self-id `$.id`).
 */
export type IdReferenceEntry =
  | {
      kind: 'id'
      path: JSONPathExpression
      /** URN of the aggregate the id targets, e.g. `urn:aggregate:nb.Note`. */
      aggregateUrn?: string
    }
  | {
      kind: 'link'
      path: JSONPathExpression
      /** Candidate aggregate URNs the link may resolve to. */
      aggregateUrns?: string[]
    }

/**
 * Per-schema URN annotations used internally by the codegen pipeline.
 * Consumer config is expressed per-command / per-representation entry; the
 * CLI collapses it to this URN-keyed form before handing it to the bundler.
 */
export interface IdReferencesForSchema {
  /** Schema URN (matches `svc:urn` or `$id` of the resolved schema). */
  urn: string
  paths: IdReferenceEntry[]
}

/**
 * Command entry — either a plain URN string or an object with per-command
 * overrides (envelope extraction, idReferences for codegen typing).
 */
export type CommandEntry =
  | string
  | {
      /** Command URN, e.g. `urn:command:nb.CreateNote:1.0.0`. */
      urn: string
      extractEnvelope?: EnvelopeExtractor
      /**
       * Per-field annotations applied to the command's *data* schema
       * (post-envelope-extraction).
       */
      idReferences?: IdReferenceEntry[]
    }

/**
 * Representation entry — either a plain representation URN string or an
 * object with per-rep idReferences for codegen typing + runtime collection
 * wiring (via `getGeneratedIdReferences`).
 */
export type RepresentationEntry =
  | string
  | {
      /** Representation URN, e.g. `urn:representation:nb.Note:1.0.0`. */
      urn: string
      /**
       * Per-field annotations applied to the rep's HAL resource schema
       * (the resource-surface response schema preferred by the fetcher).
       */
      idReferences?: IdReferenceEntry[]
    }

/**
 * Code-generation options. Grouping for knobs that affect how the codegen
 * pipeline emits TypeScript and manifests.
 */
export interface CodegenConfig {
  /**
   * Derive a TS type name from a schema's canonical identifier when the
   * schema has no top-level `title`. Receives the URN (`svc:urn` form) or
   * URL `$id`, whichever the bundler used as the schema's identity.
   *
   * The returned string must be a valid TypeScript identifier. The library
   * does not parse URN structure; without this mapper, a missing `title`
   * fails the bundle with a descriptive error.
   */
  deriveTypeName?: (urnOrId: string) => string
}

/**
 * Configuration for `cqrs-toolkit client` commands.
 */
export interface PullConfig {
  /** Base server URL (e.g. 'http://localhost:3002') */
  server: string
  /** Path to the served apidoc.jsonld (e.g. '/api/meta/apidoc') */
  apidocPath: string
  /** Absolute path to the output directory for generated files. Use path.resolve(__dirname, '...') in your config. */
  outputDir: string
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
  /** Command URNs to pull, with optional per-command overrides. */
  commands: CommandEntry[]
  /** Representation URNs to pull, with optional per-rep idReferences. */
  representations: RepresentationEntry[]
  /**
   * Which Link variant to use when emitting types for {@link IdReferenceEntry}
   * entries with `kind: 'link'`. Required when any such entry exists; absent
   * configuration with at least one link entry fails validation.
   */
  linkType?: 'Link' | 'ServiceLink'
  /**
   * Code-generation options (see {@link CodegenConfig}).
   */
  codegen?: CodegenConfig
}
