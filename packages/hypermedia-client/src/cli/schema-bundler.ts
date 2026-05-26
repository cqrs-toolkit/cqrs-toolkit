/**
 * Bundle fetched JSON Schemas into a single self-contained document.
 *
 * Walks the closure, deduplicates by URN identity, rewrites every external
 * `$ref` (URN form or URL form) into an internal `#/definitions/<name>`
 * pointer. The bundled document is what the codegen adapter consumes.
 */

import type { JSONSchema7 } from 'json-schema'
import type { IdReferenceEntry, IdReferencesForSchema } from '../config.js'
import { replaceSchemaAtPath } from './schema-path.js'

export type Role = 'shared' | 'commands' | 'reps'

/** Synthetic definition-name prefix for toolkit-external types. */
const EXTERNAL_PREFIX = '__External_'

/**
 * Toolkit-external type names that codegen may emit (via `typedPaths`).
 * The assembler maps these to import statements.
 */
export type ExternalTypeName = 'EntityId' | 'Link' | 'ServiceLink'

export const EXTERNAL_NAME_BY_KEY: Record<string, ExternalTypeName> = {
  [`${EXTERNAL_PREFIX}EntityId`]: 'EntityId',
  [`${EXTERNAL_PREFIX}Link`]: 'Link',
  [`${EXTERNAL_PREFIX}ServiceLink`]: 'ServiceLink',
}

function externalKey(name: ExternalTypeName): string {
  return `${EXTERNAL_PREFIX}${name}`
}

export type BundlerSchemaInput = JSONSchema7 | string

export interface BundlerInput {
  /** Schemas to bundle. Strings are parsed as JSON. */
  schemas: BundlerSchemaInput[]
  /** Top-level URNs whose generated types land in `commands/`. */
  commandUrns: string[]
  /** Top-level URNs whose generated types land in `reps/`. */
  representationUrns: string[]
  /** Optional per-schema-URN field annotations (ID / Link typing). */
  idReferences?: IdReferencesForSchema[]
  /** Link variant to use when idReferences contain `kind: 'link'` entries. */
  linkType?: 'Link' | 'ServiceLink'
  /**
   * Fallback type-name derivation for schemas without a top-level `title`.
   * The bundler does not parse URN structure itself; without this hook a
   * missing title is a hard error.
   */
  deriveTypeName?: (urnOrId: string) => string
}

export interface BundleResult {
  /** Single JSON Schema doc with every input under `definitions`, all refs internalized. */
  bundle: JSONSchema7
  /** URN → generated TypeScript type name (from `title`, with URN-derived fallback). */
  urnToName: Map<string, string>
  /** URN → role for routing classified output into shared/commands/reps. */
  urnToRole: Map<string, Role>
  /** Toolkit-external types referenced via `idReferences` (e.g. `EntityId`). */
  externalsUsed: Set<ExternalTypeName>
  /** Non-fatal observations (e.g. schemas not reachable from any top-level entry). */
  warnings: string[]
}

/** Synthetic root name emitted by the codegen library; classifier discards it. */
export const BUNDLE_ROOT_NAME = '_CqrsBundleRoot'

/**
 * Bundle fetched schemas into a single self-contained JSON Schema document.
 *
 * Identity is taken from `svc:urn` if present, otherwise from `$id`.
 * Type names come from `title`; if `title` is absent, {@link BundlerInput.deriveTypeName}
 * is consulted, and bundling fails if no mapper is supplied.
 * Throws on title collisions; warns on unreached schemas.
 */
export function bundleSchemas(input: BundlerInput): BundleResult {
  const warnings: string[] = []
  const byUrn = new Map<string, JSONSchema7>()
  // Every identifier a schema can be referenced by (its `svc:urn`, its `$id`)
  // mapped to its canonical URN. Lets `$ref`s in URL form resolve against a
  // schema whose canonical identity is the URN form (and vice versa).
  const aliasToCanonical = new Map<string, string>()

  const inputErrors: string[] = []
  let inputIndex = 0
  for (const raw of input.schemas) {
    const schema = typeof raw === 'string' ? (JSON.parse(raw) as JSONSchema7) : raw
    const canonical = tryGetSchemaUrn(schema)
    if (canonical === undefined) {
      inputErrors.push(formatInputError(inputIndex, `schema has neither 'svc:urn' nor '$id'`))
      inputIndex++
      continue
    }
    if (byUrn.has(canonical)) {
      warnings.push(`Duplicate schema for URN '${canonical}'; keeping first occurrence`)
      inputIndex++
      continue
    }
    byUrn.set(canonical, schema)
    registerAliases(schema, canonical, aliasToCanonical)
    inputIndex++
  }
  if (inputErrors.length > 0) {
    throw new Error(
      `bundler: ${inputErrors.length} error(s) reading input schemas:\n\n${inputErrors.join('\n\n')}`,
    )
  }

  const urnToName = buildNameMap(byUrn, input.deriveTypeName)
  const urnToRole = computeRoles(
    byUrn,
    aliasToCanonical,
    input.commandUrns,
    input.representationUrns,
    warnings,
  )

  const definitions: Record<string, JSONSchema7> = {}
  const rewriteErrors: string[] = []
  for (const [urn, schema] of byUrn) {
    const name = urnToName.get(urn)
    if (name === undefined) continue
    definitions[name] = rewriteSchema(schema, urnToName, aliasToCanonical, urn, rewriteErrors)
  }
  if (rewriteErrors.length > 0) {
    throw new Error(
      `bundler: ${rewriteErrors.length} error(s) resolving external $refs:\n\n${rewriteErrors.join('\n\n')}`,
    )
  }

  const externalsUsed = applyIdReferences(
    definitions,
    input.idReferences ?? [],
    input.linkType,
    aliasToCanonical,
    urnToName,
    warnings,
  )

  for (const external of externalsUsed) {
    const key = externalKey(external)
    definitions[key] = { type: 'string', title: key }
  }

  const bundle: JSONSchema7 = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: BUNDLE_ROOT_NAME,
    type: 'object',
    definitions,
  }

  return { bundle, urnToName, urnToRole, externalsUsed, warnings }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function tryGetSchemaUrn(schema: JSONSchema7): string | undefined {
  const svcUrn = (schema as Record<string, unknown>)['svc:urn']
  if (typeof svcUrn === 'string') return svcUrn
  if (typeof schema.$id === 'string') return schema.$id
  return undefined
}

function registerAliases(
  schema: JSONSchema7,
  canonical: string,
  aliases: Map<string, string>,
): void {
  const svcUrn = (schema as Record<string, unknown>)['svc:urn']
  if (typeof svcUrn === 'string') aliases.set(svcUrn, canonical)
  if (typeof schema.$id === 'string') aliases.set(schema.$id, canonical)
}

function buildNameMap(
  byUrn: Map<string, JSONSchema7>,
  deriveTypeName: ((urnOrId: string) => string) | undefined,
): Map<string, string> {
  const urnToName = new Map<string, string>()
  const nameToUrn = new Map<string, string>()
  const errors: string[] = []
  for (const [urn, schema] of byUrn) {
    const title = typeof schema.title === 'string' ? schema.title : undefined
    let name: string
    if (title && title.length > 0) {
      name = title
    } else if (deriveTypeName) {
      const derived = deriveTypeName(urn)
      if (typeof derived !== 'string' || derived.length === 0) {
        errors.push(
          formatNameError(
            urn,
            `'codegen.deriveTypeName' returned an invalid name (${JSON.stringify(derived)})`,
          ),
        )
        continue
      }
      name = derived
    } else {
      errors.push(
        formatNameError(urn, `no 'title' and no 'codegen.deriveTypeName' mapper configured`),
      )
      continue
    }
    const existing = nameToUrn.get(name)
    if (existing !== undefined && existing !== urn) {
      errors.push(formatCollisionError(name, existing, urn))
      continue
    }
    urnToName.set(urn, name)
    nameToUrn.set(name, urn)
  }
  if (errors.length > 0) {
    throw new Error(
      `bundler: ${errors.length} error(s) building type-name map:\n\n${errors.join('\n\n')}`,
    )
  }
  return urnToName
}

function formatNameError(schemaUrn: string, reason: string): string {
  return [`  failed to derive type name`, `    schema: ${schemaUrn}`, `    cause:  ${reason}`].join(
    '\n',
  )
}

function formatCollisionError(name: string, firstUrn: string, secondUrn: string): string {
  return [
    `  type-name collision`,
    `    name:     ${name}`,
    `    schema:   ${firstUrn}`,
    `    collides: ${secondUrn}`,
  ].join('\n')
}

function computeRoles(
  byUrn: Map<string, JSONSchema7>,
  aliasToCanonical: Map<string, string>,
  commandUrns: string[],
  representationUrns: string[],
  warnings: string[],
): Map<string, Role> {
  const reachedFromCommands = new Set<string>()
  const reachedFromReps = new Set<string>()

  for (const id of commandUrns) {
    walkReachable(id, byUrn, aliasToCanonical, reachedFromCommands)
  }
  for (const id of representationUrns) {
    walkReachable(id, byUrn, aliasToCanonical, reachedFromReps)
  }

  const topLevelCommands = canonicalize(commandUrns, aliasToCanonical)
  const topLevelReps = canonicalize(representationUrns, aliasToCanonical)
  const urnToRole = new Map<string, Role>()

  for (const urn of byUrn.keys()) {
    if (topLevelCommands.has(urn)) {
      urnToRole.set(urn, 'commands')
      continue
    }
    if (topLevelReps.has(urn)) {
      urnToRole.set(urn, 'reps')
      continue
    }
    const inCmd = reachedFromCommands.has(urn)
    const inRep = reachedFromReps.has(urn)
    if (inCmd && inRep) urnToRole.set(urn, 'shared')
    else if (inCmd) urnToRole.set(urn, 'commands')
    else if (inRep) urnToRole.set(urn, 'reps')
    else warnings.push(`Schema '${urn}' is not reachable from any top-level entry`)
  }

  return urnToRole
}

function canonicalize(ids: string[], aliasToCanonical: Map<string, string>): Set<string> {
  const out = new Set<string>()
  for (const id of ids) out.add(aliasToCanonical.get(id) ?? id)
  return out
}

function walkReachable(
  id: string,
  byUrn: Map<string, JSONSchema7>,
  aliasToCanonical: Map<string, string>,
  visited: Set<string>,
): void {
  const canonical = aliasToCanonical.get(id) ?? id
  if (visited.has(canonical)) return
  visited.add(canonical)
  const schema = byUrn.get(canonical)
  if (schema === undefined) return
  for (const ref of extractRefs(schema)) {
    walkReachable(ref, byUrn, aliasToCanonical, visited)
  }
}

function extractRefs(schema: unknown): string[] {
  const refs: string[] = []
  walkRefs(schema, refs)
  return refs
}

function walkRefs(node: unknown, refs: string[]): void {
  if (typeof node !== 'object' || node === null) return
  if (Array.isArray(node)) {
    for (const item of node) walkRefs(item, refs)
    return
  }
  const obj = node as Record<string, unknown>
  if (typeof obj['$ref'] === 'string' && !obj['$ref'].startsWith('#')) {
    refs.push(obj['$ref'])
  }
  for (const value of Object.values(obj)) walkRefs(value, refs)
}

function rewriteSchema(
  schema: JSONSchema7,
  urnToName: Map<string, string>,
  aliasToCanonical: Map<string, string>,
  schemaUrn: string,
  errors: string[],
): JSONSchema7 {
  return rewriteNode(schema, urnToName, aliasToCanonical, true, schemaUrn, errors) as JSONSchema7
}

function rewriteNode(
  node: unknown,
  urnToName: Map<string, string>,
  aliasToCanonical: Map<string, string>,
  isRoot: boolean,
  schemaUrn: string,
  errors: string[],
): unknown {
  if (Array.isArray(node)) {
    return node.map((item) =>
      rewriteNode(item, urnToName, aliasToCanonical, false, schemaUrn, errors),
    )
  }
  if (typeof node !== 'object' || node === null) return node
  const obj = node as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (isRoot && (key === '$id' || key === 'svc:urn')) {
      continue
    }
    if (key === '$ref' && typeof value === 'string' && !value.startsWith('#')) {
      const canonical = aliasToCanonical.get(value) ?? value
      const name = urnToName.get(canonical)
      if (name === undefined) {
        errors.push(formatRefError(schemaUrn, value))
        out[key] = value
        continue
      }
      out[key] = `#/definitions/${name}`
      continue
    }
    out[key] = rewriteNode(value, urnToName, aliasToCanonical, false, schemaUrn, errors)
  }
  return out
}

function formatInputError(index: number, reason: string): string {
  return [`  invalid input schema at index ${index}`, `    cause: ${reason}`].join('\n')
}

function formatRefError(schemaUrn: string, ref: string): string {
  return [
    `  unresolved external $ref`,
    `    schema: ${schemaUrn}`,
    `    ref:    ${ref}`,
    `    cause:  target not in fetched closure`,
  ].join('\n')
}

function applyIdReferences(
  definitions: Record<string, JSONSchema7>,
  idReferences: IdReferencesForSchema[],
  linkType: 'Link' | 'ServiceLink' | undefined,
  aliasToCanonical: Map<string, string>,
  urnToName: Map<string, string>,
  warnings: string[],
): Set<ExternalTypeName> {
  const externalsUsed = new Set<ExternalTypeName>()
  // Collect failures across all entries/paths rather than failing on the first
  // — surfaces every broken annotation in one CLI run instead of one fix at a
  // time. Aggregated into a single thrown Error at the end if non-empty.
  const errors: string[] = []
  for (const entry of idReferences) {
    const canonical = aliasToCanonical.get(entry.urn) ?? entry.urn
    const name = urnToName.get(canonical)
    if (name === undefined) {
      warnings.push(`idReferences: schema URN '${entry.urn}' was not bundled; skipping`)
      continue
    }
    const target = definitions[name]
    if (target === undefined) continue
    for (const p of entry.paths) {
      let externalName: ExternalTypeName
      if (p.kind === 'id') {
        externalName = 'EntityId'
      } else {
        if (linkType === undefined) {
          errors.push(
            formatPathError(canonical, name, p, "has kind 'link' but no 'linkType' configured"),
          )
          continue
        }
        externalName = linkType
      }
      try {
        replaceSchemaAtPath(target, p.path, { $ref: `#/definitions/${externalKey(externalName)}` })
        externalsUsed.add(externalName)
      } catch (cause) {
        const innerMessage = cause instanceof Error ? cause.message : String(cause)
        // The inner errors from schema-path repeat `Path 'X': ...`; strip
        // that prefix so the wrapped error doesn't duplicate the path line.
        const reason = innerMessage.replace(/^Path '[^']*':\s*/, '')
        errors.push(formatPathError(canonical, name, p, reason))
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(
      `idReferences: ${errors.length} error(s) applying entries:\n\n${errors.join('\n\n')}`,
    )
  }
  return externalsUsed
}

function formatPathError(
  schemaUrn: string,
  typeName: string,
  p: IdReferenceEntry,
  reason: string,
): string {
  return [
    `  failed to apply ${p.kind} entry`,
    `    schema: ${schemaUrn} (${typeName})`,
    `    path:   ${p.path}`,
    `    cause:  ${reason}`,
  ].join('\n')
}
