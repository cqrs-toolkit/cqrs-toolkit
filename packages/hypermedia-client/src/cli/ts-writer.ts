/**
 * Generate TypeScript output files from parsed apidoc data.
 */

import crypto from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RepresentationManifest } from '../runtime/types.js'
import type { ParsedCommand } from './apidoc-parser.js'
import type { FetchedCommonSchema, FetchedSchema } from './schema-fetcher.js'

interface SchemasInput {
  commands: FetchedSchema[]
  common: FetchedCommonSchema[]
  commonCommands: string[]
}

/**
 * Render entries into an indented block body. Returns empty string when no
 * entries, so `{${block(entries)}}` produces `{}` when empty and
 * `{\n  ...,\n}` when populated.
 */
function block(entries: string[], padding = ''): string {
  if (entries.length === 0) return ''
  return `${padding}\n${entries.join(',\n')},\n${padding}`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function writeGeneratedOutput(opts: {
  outputDir: string
  apidocUrl: string
  commands: Map<string, ParsedCommand>
  representations: RepresentationManifest
  schemas: SchemasInput
}): void {
  const { outputDir, apidocUrl, commands, representations, schemas } = opts

  mkdirSync(outputDir, { recursive: true })

  // commands.ts
  writeFileSync(join(outputDir, 'commands.ts'), generateCommandsTs(commands))

  // representations.ts
  writeFileSync(join(outputDir, 'representations.ts'), generateRepresentationsTs(representations))

  // schemas/ directory + schemas.ts — clear stale files before writing
  const schemasDir = join(outputDir, 'schemas')
  rmSync(schemasDir, { recursive: true, force: true })
  mkdirSync(schemasDir, { recursive: true })
  for (const schema of schemas.commands) {
    writeFileSync(join(schemasDir, `${schema.name}.json`), schema.content + '\n')
  }
  for (const schema of schemas.common) {
    writeFileSync(join(schemasDir, `${schema.name}.json`), schema.content + '\n')
  }
  writeFileSync(join(outputDir, 'schemas.ts'), generateSchemasTs(schemas))

  // meta.json
  const meta = {
    pulledAt: new Date().toISOString(),
    apidocUrl,
    schemas: schemas.commands.map((s) => ({
      name: s.name,
      url: s.url,
      sha256: sha256(s.content),
    })),
    commonSchemas: schemas.common.map((s) => ({
      name: s.name,
      id: s.id,
      sha256: sha256(s.content),
    })),
  }
  writeFileSync(join(outputDir, 'meta.json'), JSON.stringify(meta, undefined, 2) + '\n')
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

function generateCommandsTs(commands: Map<string, ParsedCommand>): string {
  const entries: string[] = []
  for (const [name, cmd] of commands) {
    const mappingsStr = cmd.mappings
      .map((m) => `{ variable: '${m.variable}', required: ${m.required} }`)
      .join(', ')

    const responseSchemaStr = cmd.responseSchema
      ?.map((rs) => `{ contentType: '${rs.contentType}', schemaUrl: '${rs.schemaUrl}' }`)
      .join(', ')

    const workflowStr = cmd.workflow
      ? `{ type: '${cmd.workflow.type}'${cmd.workflow.nextStepId ? `, nextStepId: '${cmd.workflow.nextStepId}'` : ''} }`
      : undefined

    const fields = [
      `      urn: '${cmd.urn}'`,
      `      dispatch: '${cmd.dispatch}'`,
      ...(cmd.commandType ? [`      commandType: '${cmd.commandType}'`] : []),
      `      template: '${cmd.template}'`,
      `      mappings: [${mappingsStr}]`,
      ...(responseSchemaStr ? [`      responseSchema: [${responseSchemaStr}]`] : []),
      ...(workflowStr ? [`      workflow: ${workflowStr}`] : []),
    ]

    entries.push(`    '${name}': {\n${fields.join(',\n')},\n    }`)
  }

  // Generate AppCommand discriminated union type
  const unionMembers: string[] = []
  for (const [name, cmd] of commands) {
    const requiredMappings = cmd.mappings.filter((m) => m.required)
    const fields: string[] = [`type: '${name}'`]
    if (requiredMappings.length > 0) {
      const pathFields = requiredMappings.map((m) => `${m.variable}: string`).join('; ')
      fields.push(`path: { ${pathFields} }`)
    }
    fields.push('data: unknown')
    if (cmd.workflow) {
      // All upload workflows are single-file per request
      fields.push('files: [File]')
    }
    if (requiredMappings.length > 0) {
      fields.push('revision?: string | AutoRevision')
    }
    unionMembers.push(`  | { ${fields.join('; ')} }`)
  }

  const unionType =
    unionMembers.length > 0 ? `\nexport type AppCommand =\n${unionMembers.join('\n')}\n` : ''

  return `/**
 * Generated command routing manifest — do not edit.
 * Regenerate with: cqrs-pull generate
 */

import type { AutoRevision } from '@cqrs-toolkit/client'
import type { CommandManifest } from '@cqrs-toolkit/hypermedia-client'

export const commands: CommandManifest = {
  commands: {${block(entries, '  ')}},
}
${unionType}`
}

function generateRepresentationsTs(representations: RepresentationManifest): string {
  const entries: string[] = []
  for (const [className, rep] of Object.entries(representations)) {
    const surfaceStr = (s: { href?: string; template: string }) => {
      const fields = [...(s.href ? [`href: '${s.href}'`] : []), `template: '${s.template}'`]
      return `{ ${fields.join(', ')} }`
    }

    entries.push(`  '${className}': {
    version: '${rep.version}',
    collection: ${surfaceStr(rep.collection)},
    resource: ${surfaceStr(rep.resource)},
    itemEvents: ${surfaceStr(rep.itemEvents)},
    aggregateEvents: ${surfaceStr(rep.aggregateEvents)},
  }`)
  }

  const keys = Object.keys(representations)
    .map((k) => `  '${k}': RepresentationSurfaces`)
    .join('\n')

  return `/**
 * Generated representation surfaces — do not edit.
 * Regenerate with: cqrs-pull generate
 */

import type { RepresentationSurfaces } from '@cqrs-toolkit/hypermedia-client'

interface Representations {
${keys}
}

export const representations: Representations = {${block(entries)}}
`
}

function generateSchemasTs(schemas: SchemasInput): string {
  const allSchemas = [...schemas.commands, ...schemas.common]
  if (allSchemas.length === 0) {
    return `/**
 * Generated schema imports — do not edit.
 * Regenerate with: cqrs-pull generate
 */

import type { SchemaRegistry } from '@cqrs-toolkit/hypermedia-client'

export const schemas: SchemaRegistry = { commands: {}, common: {} }
`
  }

  const imports = allSchemas
    .map(
      (s) => `import ${toIdentifier(s.name)} from './schemas/${s.name}.json' with { type: 'json' }`,
    )
    .join('\n')

  const commandEntries = schemas.commands.map(
    (s) => `    ${quoteKey(s.name)}: ${toIdentifier(s.name)} as JSONSchema7`,
  )

  const commonEntries = schemas.common.map(
    (s) => `    '${s.id}': ${toIdentifier(s.name)} as JSONSchema7`,
  )

  const commonCommandsLine =
    schemas.commonCommands.length > 0
      ? `\n  commonCommands: [${schemas.commonCommands.map((k) => `'${k}'`).join(', ')}],`
      : ''

  return `/**
 * Generated schema imports — do not edit.
 * Regenerate with: cqrs-pull generate
 */

import type { SchemaRegistry } from '@cqrs-toolkit/hypermedia-client'
import type { JSONSchema7 } from 'json-schema'
${imports}

export const schemas: SchemaRegistry = {
  commands: {${block(commandEntries, '  ')}},
  common: {${block(commonEntries, '  ')}},${commonCommandsLine}
}
`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

const VALID_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/

function toIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_$]/g, '_')
}

function quoteKey(name: string): string {
  return VALID_IDENTIFIER.test(name) ? name : `'${name}'`
}
