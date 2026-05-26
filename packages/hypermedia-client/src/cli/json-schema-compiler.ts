/**
 * Compile a bundled JSON Schema document into TypeScript source.
 *
 * The {@link JsonSchemaToTsCompiler} interface is the only place
 * library-specific code lives. Swap implementations by changing what is
 * constructed in the pipeline; the rest of the codegen flow consumes a
 * plain TypeScript source string and is unaware of the library backing it.
 */

import type { JSONSchema4, JSONSchema7 } from 'json-schema'
import { compile as jsttCompile } from 'json-schema-to-typescript'
import { BUNDLE_ROOT_NAME } from './schema-bundler.js'

export interface JsonSchemaToTsCompiler {
  /**
   * Compile a single bundled JSON Schema document into TypeScript source.
   * The bundle must be self-contained — every `$ref` resolves to a
   * `#/definitions/<name>` pointer within the same document.
   */
  compile(bundle: JSONSchema7): Promise<string>
}

/**
 * Compiler backed by {@link https://github.com/bcherny/json-schema-to-typescript json-schema-to-typescript}.
 *
 * Configured for the cqrs-toolkit conventions:
 * - emit unreachable definitions (every entry in `definitions` becomes a type)
 * - string-literal unions for enums (no TS `enum` declarations)
 * - strict index signatures (compatible with `strictNullChecks`)
 * - `unknown` instead of `any`
 * - no banner comment (caller adds its own during file assembly)
 */
export function createJsonSchemaToTypescriptCompiler(): JsonSchemaToTsCompiler {
  return {
    async compile(bundle) {
      // json-schema-to-typescript's signature insists on the draft-4 type but
      // accepts draft-7 documents in practice; widening through `unknown` so
      // the call type-checks without copying the bundle into a draft-4 shape.
      return jsttCompile(bundle as unknown as JSONSchema4, BUNDLE_ROOT_NAME, {
        bannerComment: '',
        unreachableDefinitions: true,
        additionalProperties: false,
        enableConstEnums: false,
        unknownAny: true,
        strictIndexSignatures: true,
      })
    },
  }
}
