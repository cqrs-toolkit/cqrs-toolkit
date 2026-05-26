/**
 * Orchestrates the schema-to-TypeScript codegen pipeline:
 * {@link bundleSchemas} → {@link JsonSchemaToTsCompiler} → {@link classifyDeclarations} → {@link assembleFiles}.
 *
 * Returns three TypeScript source strings (one per role) plus diagnostics.
 * The caller writes the strings to disk and decides how to surface diagnostics.
 */

import type { JSONSchema7 } from 'json-schema'
import type { IdReferencesForSchema } from '../config.js'
import { assembleFiles } from './assembler.js'
import { classifyDeclarations } from './classifier.js'
import {
  createJsonSchemaToTypescriptCompiler,
  type JsonSchemaToTsCompiler,
} from './json-schema-compiler.js'
import { BUNDLE_ROOT_NAME, bundleSchemas } from './schema-bundler.js'

export interface CodegenInput {
  /** Every schema to consider (commands, responses, common). String or object. */
  schemas: (JSONSchema7 | string)[]
  /** URNs of top-level command data schemas. Bundle entries here land in `commands/`. */
  commandUrns: string[]
  /** URNs of top-level representation response schemas. Bundle entries here land in `reps/`. */
  representationUrns: string[]
  /** Per-schema-URN field annotations (forwarded to the bundler). */
  idReferences?: IdReferencesForSchema[]
  /** Link variant for `idReferences` entries with `kind: 'link'`. */
  linkType?: 'Link' | 'ServiceLink'
  /** Banner prepended to every generated file. */
  bannerComment?: string
  /** Optional compiler override. Defaults to the json-schema-to-typescript adapter. */
  compiler?: JsonSchemaToTsCompiler
  /**
   * Fallback type-name derivation when a schema has no `title`. Forwarded to
   * the bundler. Without it, schemas missing a title fail the bundle.
   */
  deriveTypeName?: (urnOrId: string) => string
}

export interface CodegenResult {
  /** TS source for `shared/types.ts`. */
  shared: string
  /** TS source for `commands/types.ts`. */
  commands: string
  /** TS source for `reps/types.ts`. */
  reps: string
  /** Diagnostics worth surfacing but not blocking. */
  warnings: string[]
  /** Hard errors (cross-role references). Caller should fail the build. */
  errors: string[]
  /** Declaration names the compiler emitted that weren't in our expected set. */
  unexpected: string[]
}

/**
 * Run the full codegen pipeline. Pure with respect to the filesystem — the
 * caller writes the returned strings.
 */
export async function generateTypes(input: CodegenInput): Promise<CodegenResult> {
  const bundled = bundleSchemas({
    schemas: input.schemas,
    commandUrns: input.commandUrns,
    representationUrns: input.representationUrns,
    idReferences: input.idReferences,
    linkType: input.linkType,
    deriveTypeName: input.deriveTypeName,
  })

  const compiler = input.compiler ?? createJsonSchemaToTypescriptCompiler()
  const source = await compiler.compile(bundled.bundle)

  const ignoreNames = new Set<string>([BUNDLE_ROOT_NAME])
  for (const external of bundled.externalsUsed) {
    ignoreNames.add(`__External_${external}`)
  }

  const classified = classifyDeclarations({
    source,
    nameToUrn: invert(bundled.urnToName),
    urnToRole: bundled.urnToRole,
    ignoreNames,
  })

  const assembled = assembleFiles({
    source,
    declarations: classified.declarations,
    bannerComment: input.bannerComment,
  })

  return {
    shared: assembled.shared,
    commands: assembled.commands,
    reps: assembled.reps,
    warnings: [...bundled.warnings, ...classified.warnings],
    errors: classified.errors,
    unexpected: classified.unexpected,
  }
}

function invert<K, V>(m: Map<K, V>): Map<V, K> {
  const out = new Map<V, K>()
  for (const [k, v] of m) out.set(v, k)
  return out
}
