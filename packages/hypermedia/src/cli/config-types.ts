/**
 * Configuration types for `cqrs-toolkit server` commands.
 */

import type { HydraDoc } from '../HydraDoc.js'
import type { HydraPropertyDocumentation } from '../builder/OpenApiBuilder.js'

export interface OpenApiConfig {
  info: { title: string; version: string }
  hydraPropertyDictionary?: Record<string, HydraPropertyDocumentation>
  globalResponses?: HydraDoc.ResolvedResponseDef[]
  responses?: HydraDoc.ResolvedResponseDef[]
  /**
   * Header definitions consumers can reference by name in operation `requestHeaders` lists.
   * Keys are header names; values omit `name` since the key supplies it. The reserved names
   * `Content-Type`, `Accept`, and `Authorization` are skipped at resolution time per OpenAPI
   * 3.1 (expressed structurally via `requestBody.content` keys / `responses[*].content` keys
   * / `securitySchemes` instead).
   *
   * OpenAPI-only; has no effect on `apidoc.jsonld`.
   */
  requestHeaders?: Record<string, HydraDoc.HeaderDef>
  /**
   * Headers applied to every operation. Cannot be opted out by per-operation declarations
   * (mirrors `globalResponses` semantics). Per-operation declarations with the same canonical
   * name (case-insensitive) override the global value for that operation; the header itself
   * remains present.
   *
   * OpenAPI-only; has no effect on `apidoc.jsonld`.
   */
  globalRequestHeaders?: readonly HydraDoc.HeaderEntry[]
  /**
   * Header definitions consumers can reference by name in response `responseHeaders` lists.
   * Keys are header names; values omit `name` since the key supplies it.
   *
   * OpenAPI-only; has no effect on `apidoc.jsonld`.
   */
  responseHeaders?: Record<string, HydraDoc.HeaderDef>
  /**
   * Headers applied to every emitted response across every status code. Cannot be opted out
   * by per-response declarations. Per-`ResponseDef.responseHeaders` declarations with the
   * same canonical name override the global value for that response; the header itself
   * remains present. Applied alongside `globalResponses`-created responses too.
   *
   * OpenAPI-only; has no effect on `apidoc.jsonld`.
   */
  globalResponseHeaders?: readonly HydraDoc.HeaderEntry[]
}

/** Schema URN resolution functions. */
export interface SchemaUrnResolver {
  /**
   * Relative segment from docsEntrypoint where schemas are served from.
   * Must not begin or end in a / but may contain them.
   * @example 'schemas', 'components/schemas'
   */
  pathSegment: string
  /** Test whether a string value is a schema URN that should be resolved. */
  isUrn: (v: string) => boolean
  /** Convert a schema URN to a dereferenceable URL. */
  mapUrnToUrl: (urn: string) => string
}

export interface HydraConfig {
  /** Hydra class definitions to document */
  classes: HydraDoc.ClassDef[]
  /** Domain CURIE prefix names used in classes/mappings */
  prefixes: string[]
  /** Extra JSON-LD context terms */
  extraContext?: Record<string, unknown>
  /** Throw on unknown prefix (default: true) */
  strictPrefixes?: boolean
  /** OpenAPI generation config. Omit to skip OpenAPI generation. */
  openapi?: OpenApiConfig
  /** configuration specific to the stable documentation generator command */
  docs: {
    /** Absolute path to the output directory for generated files. Use path.resolve(__dirname, '...') in your config. */
    outputDir: string
  }
  /** configuration specific to the production docs generator build command */
  build: {
    /** Absolute path to the output directory for generated files. Use path.resolve(__dirname, '...') in your config. */
    outputDir: string
  }
  /**
   * Named environment map for URN resolution.
   * Each key is an environment name, values contain the base URLs (e.g. docs at 'http://localhost:3002/api/meta').
   * The `dev` environment is used by default for OpenAPI validation.
   */
  environments?: Record<string, EnvironmentConfig>
  /**
   * Schema URN resolution. Required when classes define schemas.
   * Controls how schema identifiers are detected and mapped to dereferenceable URLs.
   */
  schema?: SchemaUrnResolver
}

export interface EnvironmentConfig {
  apiEntrypoint: string
  documentEntrypoint: string
}
