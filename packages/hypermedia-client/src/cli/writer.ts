/**
 * Write pull output to disk.
 */

import crypto from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ParsedCommand } from './apidoc-parser.js'
import type { FetchedSchema } from './schema-fetcher.js'

// ---------------------------------------------------------------------------
// Output file types
// ---------------------------------------------------------------------------

interface CommandEntry {
  urn: string
  dispatch: string
  commandType?: string
  template: string
  mappings: { variable: string; required: boolean }[]
}

interface CommandsManifest {
  commands: Record<string, CommandEntry>
}

interface SchemaMeta {
  name: string
  url: string
  sha256: string
}

interface PullMeta {
  pulledAt: string
  apidocUrl: string
  schemas: SchemaMeta[]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Write commands.json, meta.json, and schema files to the output directory.
 */
export function writeOutput(opts: {
  outputDir: string
  apidocUrl: string
  commands: Map<string, ParsedCommand>
  schemas: FetchedSchema[]
}): void {
  const { outputDir, apidocUrl, commands, schemas } = opts

  mkdirSync(outputDir, { recursive: true })

  const manifest = buildManifest(commands)
  writeFileSync(join(outputDir, 'commands.json'), JSON.stringify(manifest, undefined, 2) + '\n')

  const schemasDir = join(outputDir, 'schemas')
  mkdirSync(schemasDir, { recursive: true })
  const schemaMetas: SchemaMeta[] = []
  for (const schema of schemas) {
    const filename = `${schema.name}.json`
    writeFileSync(join(schemasDir, filename), schema.content + '\n')
    schemaMetas.push({
      name: schema.name,
      url: schema.url,
      sha256: sha256(schema.content),
    })
  }

  const meta: PullMeta = {
    pulledAt: new Date().toISOString(),
    apidocUrl,
    schemas: schemaMetas,
  }
  writeFileSync(join(outputDir, 'meta.json'), JSON.stringify(meta, undefined, 2) + '\n')
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function buildManifest(commands: Map<string, ParsedCommand>): CommandsManifest {
  const entries: Record<string, CommandEntry> = {}
  for (const [name, cmd] of commands) {
    const entry: CommandEntry = {
      urn: cmd.urn,
      dispatch: cmd.dispatch,
      template: cmd.template,
      mappings: cmd.mappings,
    }
    if (cmd.commandType) {
      entry.commandType = cmd.commandType
    }
    entries[name] = entry
  }
  return { commands: entries }
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}
