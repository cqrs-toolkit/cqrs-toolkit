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
    /** Output directory for generated files (relative to config file location) */
    outputDir: string
  }
  /** configuration specific to the production docs generator build command */
  build: {
    /** Output directory for generated files (relative to config file location) */
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
