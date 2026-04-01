/**
 * CLI `generate` command: fetch apidoc, parse commands + representations,
 * download schemas, extract data schemas from envelopes, write generated TypeScript output.
 */

import type { JSONSchema7 } from 'json-schema'
import type { EnvelopeExtractor, FileCardinality } from '../config.js'
import { parseApidoc, type ParsedCommand } from './apidoc-parser.js'
import { parseRepresentations } from './apidoc-representations.js'
import { loadConfig } from './config.js'
import { fetchSchemas, type FetchedCommonSchema, type FetchedSchema } from './schema-fetcher.js'
import { writeGeneratedOutput } from './ts-writer.js'

export async function pull(projectRoot: string): Promise<void> {
  const config = await loadConfig(projectRoot)
  const apidocUrl = `${config.server}${config.apidocPath}`

  // Extract URNs and per-command overrides from CommandEntry[]
  const commandUrns: string[] = []
  const perCommandExtractors = new Map<string, EnvelopeExtractor>()
  const perCommandFiles = new Map<string, FileCardinality>()
  for (const entry of config.commands) {
    if (typeof entry === 'string') {
      commandUrns.push(entry)
    } else {
      commandUrns.push(entry.urn)
      if (entry.extractEnvelope) {
        perCommandExtractors.set(entry.urn, entry.extractEnvelope)
      }
      if (entry.files) {
        perCommandFiles.set(entry.urn, entry.files)
      }
    }
  }

  console.log(`Fetching apidoc from ${apidocUrl}`)
  const res = await fetch(apidocUrl)
  if (!res.ok) {
    throw new Error(`Failed to fetch apidoc: ${res.status} ${res.statusText}`)
  }
  const apidoc: unknown = await res.json()

  // Parse commands
  console.log(`Parsing ${commandUrns.length} command(s)`)
  const commandResult = parseApidoc(apidoc, commandUrns)

  if (commandResult.missing.length > 0) {
    console.warn(`\nWarning: ${commandResult.missing.length} command(s) not found in apidoc:`)
    for (const urn of commandResult.missing) {
      console.warn(`  - ${urn}`)
    }
  }

  if (commandResult.commands.size === 0) {
    throw new Error('No matching commands found in apidoc')
  }

  // Stamp file cardinality from config onto parsed commands
  for (const [, cmd] of commandResult.commands) {
    const files = perCommandFiles.get(cmd.urn)
    if (files) {
      cmd.files = files
    }
  }

  // Parse representations
  console.log(`Parsing ${config.representations.length} representation(s)`)
  const repResult = parseRepresentations(apidoc, config.representations)

  if (repResult.missing.length > 0) {
    console.warn(`\nWarning: ${repResult.missing.length} representation(s) not found in apidoc:`)
    for (const id of repResult.missing) {
      console.warn(`  - ${id}`)
    }
  }

  // Fetch schemas (command + transitive $ref dependencies)
  console.log(`Found ${commandResult.commands.size} command(s), fetching schemas...`)
  const rawSchemas = await fetchSchemas(commandResult.commands)

  // Apply envelope extraction: resolve data schemas from envelope wrappers
  const extracted = applyEnvelopeExtraction(
    rawSchemas,
    commandResult.commands,
    perCommandExtractors,
    config.extractCreate,
    config.extractCommand,
  )

  // Write generated output
  writeGeneratedOutput({
    outputDir: config.resolvedOutputDir,
    apidocUrl,
    commands: commandResult.commands,
    representations: repResult.representations,
    schemas: extracted,
  })

  const repCount = Object.keys(repResult.representations).length
  const totalSchemas = extracted.commands.length + extracted.common.length
  console.log(`\nWrote to ${config.resolvedOutputDir}/`)
  console.log(`  commands.ts         (${commandResult.commands.size} commands)`)
  console.log(`  representations.ts  (${repCount} representations)`)
  console.log(
    `  schemas.ts          (${extracted.commands.length} command + ${extracted.common.length} common schemas)`,
  )
  console.log(`  schemas/            (${totalSchemas} files)`)
  console.log(`  meta.json`)
}

// ---------------------------------------------------------------------------
// Envelope extraction
// ---------------------------------------------------------------------------

interface ExtractedSchemas {
  commands: FetchedSchema[]
  common: FetchedCommonSchema[]
  commonCommands: string[]
}

function applyEnvelopeExtraction(
  raw: { commands: FetchedSchema[]; common: FetchedCommonSchema[] },
  parsedCommands: Map<string, ParsedCommand>,
  perCommandExtractors: Map<string, EnvelopeExtractor>,
  extractCreate: EnvelopeExtractor | undefined,
  extractCommand: EnvelopeExtractor | undefined,
): ExtractedSchemas {
  // Build common lookup by $id
  const commonById = new Map<string, FetchedCommonSchema>()
  for (const c of raw.common) {
    commonById.set(c.id, c)
  }

  // For each command schema, apply extraction to resolve the data schema
  const resolvedCommands: FetchedSchema[] = []
  for (const cmdSchema of raw.commands) {
    const parsed = parsedCommands.get(cmdSchema.name)
    if (!parsed) {
      resolvedCommands.push(cmdSchema)
      continue
    }

    // Determine extractor: per-command override > dispatch-level > none
    const perCommand = perCommandExtractors.get(parsed.urn)
    let extractor: EnvelopeExtractor | undefined
    if (perCommand) {
      extractor = perCommand
    } else if (parsed.dispatch === 'create') {
      extractor = extractCreate
    } else if (parsed.dispatch === 'command') {
      extractor = extractCommand
    }

    if (!extractor) {
      resolvedCommands.push(cmdSchema)
      continue
    }

    const schema: JSONSchema7 = JSON.parse(cmdSchema.content)
    const dataSchemaId = extractor(schema)
    if (dataSchemaId === undefined) {
      resolvedCommands.push(cmdSchema)
      continue
    }

    // Replace the command schema with the referenced data schema
    const dataSchema = commonById.get(dataSchemaId)
    if (!dataSchema) {
      throw new Error(
        `Envelope extraction for "${cmdSchema.name}" resolved to $id "${dataSchemaId}" ` +
          `but no schema with that $id was fetched. Check the $ref target exists.`,
      )
    }

    resolvedCommands.push({
      name: cmdSchema.name,
      url: dataSchema.id,
      content: dataSchema.content,
    })
  }

  // Prune: walk resolved command schemas, collect only the common schemas they still reference
  const referencedIds = new Set<string>()
  const resolvedSchemaIds = new Set<string>()
  for (const cmd of resolvedCommands) {
    const schema: JSONSchema7 = JSON.parse(cmd.content)
    if (typeof schema.$id === 'string') {
      resolvedSchemaIds.add(schema.$id)
    }
    collectRefs(schema, referencedIds)
  }

  // Transitively resolve common schema refs
  const pending = [...referencedIds]
  while (pending.length > 0) {
    const id = pending.pop()
    if (typeof id !== 'string') continue
    const common = commonById.get(id)
    if (!common) continue
    const schema: JSONSchema7 = JSON.parse(common.content)
    const newRefs: Set<string> = new Set()
    collectRefs(schema, newRefs)
    for (const ref of newRefs) {
      if (!referencedIds.has(ref)) {
        referencedIds.add(ref)
        pending.push(ref)
      }
    }
  }

  // Check if any command schema is also referenced as a $ref target
  const commonCommands: string[] = []
  for (const cmd of resolvedCommands) {
    const schema: JSONSchema7 = JSON.parse(cmd.content)
    if (typeof schema.$id === 'string' && referencedIds.has(schema.$id)) {
      commonCommands.push(cmd.name)
    }
  }

  // Filter common to only referenced schemas (exclude those that became command schemas)
  const prunedCommon = raw.common.filter(
    (c) => referencedIds.has(c.id) && !resolvedSchemaIds.has(c.id),
  )

  return { commands: resolvedCommands, common: prunedCommon, commonCommands }
}

function collectRefs(node: unknown, refs: Set<string>): void {
  if (typeof node !== 'object' || node === null) return
  if (Array.isArray(node)) {
    for (const item of node) {
      collectRefs(item, refs)
    }
    return
  }
  const obj = node as Record<string, unknown>
  if (typeof obj['$ref'] === 'string' && obj['$ref'].startsWith('http')) {
    refs.add(obj['$ref'])
  }
  for (const value of Object.values(obj)) {
    collectRefs(value, refs)
  }
}
