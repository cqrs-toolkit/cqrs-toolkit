/**
 * CLI `generate` command: fetch apidoc, parse commands + representations,
 * download schemas, extract data schemas from envelopes, write generated TypeScript output.
 */

import type { HydraApiDocumentation } from '@cqrs-toolkit/hypermedia'
import type { JSONSchema7 } from 'json-schema'
import type {
  EnvelopeExtractor,
  IdReferenceEntry,
  IdReferencesForSchema,
  PullConfig,
} from '../config.js'
import type { GeneratedIdReference, RepresentationManifest } from '../runtime/types.js'
import { parseApidoc, type ParsedCommand } from './apidoc-parser.js'
import {
  parseRepresentations,
  type RepresentationResponseSchemas,
} from './apidoc-representations.js'
import { fetchSchemas, type FetchedCommonSchema, type FetchedSchema } from './schema-fetcher.js'
import { writeGeneratedOutput } from './ts-writer.js'
import { generateTypes } from './type-codegen.js'

const HAL_CONTENT_TYPE = 'application/hal+json'

export async function pull(config: PullConfig): Promise<void> {
  const apidocUrl = `${config.server}${config.apidocPath}`

  // Extract URNs and per-command overrides from CommandEntry[]
  const commandUrns: string[] = []
  const perCommandExtractors = new Map<string, EnvelopeExtractor>()
  const commandIdReferencesByUrn = new Map<string, IdReferenceEntry[]>()
  for (const entry of config.commands) {
    if (typeof entry === 'string') {
      commandUrns.push(entry)
    } else {
      commandUrns.push(entry.urn)
      if (entry.extractEnvelope) {
        perCommandExtractors.set(entry.urn, entry.extractEnvelope)
      }
      if (entry.idReferences && entry.idReferences.length > 0) {
        commandIdReferencesByUrn.set(entry.urn, entry.idReferences)
      }
    }
  }

  // Same for representations.
  const representationUrns: string[] = []
  const repIdReferencesByUrn = new Map<string, IdReferenceEntry[]>()
  for (const entry of config.representations) {
    if (typeof entry === 'string') {
      representationUrns.push(entry)
    } else {
      representationUrns.push(entry.urn)
      if (entry.idReferences && entry.idReferences.length > 0) {
        repIdReferencesByUrn.set(entry.urn, entry.idReferences)
      }
    }
  }

  console.log(`Fetching apidoc from ${apidocUrl}`)
  const res = await fetch(apidocUrl)
  if (!res.ok) {
    throw new Error(`Failed to fetch apidoc: ${res.status} ${res.statusText}`)
  }
  const apidoc: HydraApiDocumentation.Document = await res.json()

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

  // Parse representations
  console.log(`Parsing ${representationUrns.length} representation(s)`)
  const repResult = parseRepresentations(apidoc, representationUrns)

  if (repResult.missing.length > 0) {
    console.warn(`\nWarning: ${repResult.missing.length} representation(s) not found in apidoc:`)
    for (const id of repResult.missing) {
      console.warn(`  - ${id}`)
    }
  }

  // Fetch schemas (command + response + transitive $ref dependencies)
  console.log(`Found ${commandResult.commands.size} command(s), fetching schemas...`)
  const rawSchemas = await fetchSchemas(commandResult.commands, repResult.responseSchemas)

  // Detect any URN claimed by more than one URL the server actually served.
  // Post-extraction the same canonical URN legitimately appears on every
  // command that shares a core data schema, so this has to run on the raw
  // fetch — afterwards is structurally noise.
  warnOnCrossUrlUrnCollisions(rawSchemas)

  // Apply envelope extraction: resolve command data schemas from envelope wrappers.
  // Responses are pass-through; common is pruned to what surviving commands still reference.
  const extracted = applyEnvelopeExtraction(
    rawSchemas,
    commandResult.commands,
    perCommandExtractors,
    config.extractCreate,
    config.extractCommand,
  )

  // Build per-schema idReferences by mapping each consumer-config entry's
  // idReferences onto its resolved schema URL.
  const idReferences = collectIdReferences({
    commandIdReferencesByUrn,
    repIdReferencesByUrn,
    parsedCommands: commandResult.commands,
    extractedCommands: extracted.commands,
    repResponseSchemas: repResult.responseSchemas,
    repUrnByClassName: buildRepUrnByClassName(repResult.representations),
  })

  // Generate TS types via the bundle → compile → classify → assemble pipeline.
  const codegen = await generateTypes({
    schemas: [
      ...extracted.commands.map((s) => s.content),
      ...extracted.responses.map((s) => s.content),
      ...extracted.common.map((s) => s.content),
    ],
    commandUrns: extracted.commands.map((s) => s.url),
    representationUrns: extracted.responses.map((s) => s.url),
    idReferences,
    linkType: config.linkType,
    deriveTypeName: config.codegen?.deriveTypeName,
  })

  // Populate `generatedIdReferences` on each rep manifest entry. Filters
  // self-id entries (no aggregateUrn) — they exist for codegen typing only.
  populateGeneratedIdReferences(repResult.representations, repIdReferencesByUrn)

  for (const warn of codegen.warnings) {
    console.warn(`warning: ${warn}`)
  }
  if (codegen.unexpected.length > 0) {
    console.warn(
      `warning: compiler emitted ${codegen.unexpected.length} unexpected type name(s): ${codegen.unexpected.join(', ')}`,
    )
  }
  if (codegen.errors.length > 0) {
    for (const err of codegen.errors) {
      console.error(`error: ${err}`)
    }
    throw new Error('Type generation failed; see errors above.')
  }

  // Build command-name → generated-TS-type-name map by reading `title` off
  // each command's (post-extraction) data schema. The bundler uses `title` as
  // the type name, so the same string appears in the generated commands-types
  // file and lets the AppCommand union refer to it.
  const commandDataTypeNames = new Map<string, string>()
  for (const cmd of extracted.commands) {
    try {
      const schema: { title?: string } = JSON.parse(cmd.content)
      if (typeof schema.title === 'string' && schema.title.length > 0) {
        commandDataTypeNames.set(cmd.name, schema.title)
      }
    } catch {
      // Schema parse failures will already surface in the codegen pass above.
    }
  }

  writeGeneratedOutput({
    outputDir: config.outputDir,
    apidocUrl,
    commands: commandResult.commands,
    representations: repResult.representations,
    schemas: extracted,
    generatedTypes: {
      shared: codegen.shared,
      commands: codegen.commands,
      reps: codegen.reps,
    },
    commandDataTypeNames,
  })

  const repCount = Object.keys(repResult.representations).length
  const totalSchemas =
    extracted.commands.length + extracted.responses.length + extracted.common.length
  console.log(`\nWrote to ${config.outputDir}/`)
  console.log(`  commands/manifest.ts (${commandResult.commands.size} commands)`)
  console.log(`  commands/types.ts    (generated request types)`)
  console.log(`  reps/manifest.ts     (${repCount} representations)`)
  console.log(`  reps/types.ts        (generated response types)`)
  console.log(`  shared/types.ts      (generated shared types)`)
  console.log(
    `  schemas.ts           (${extracted.commands.length} command + ${extracted.responses.length} response + ${extracted.common.length} common schemas)`,
  )
  console.log(`  schemas/             (${totalSchemas} files)`)
  console.log(`  meta.json`)
}

// ---------------------------------------------------------------------------
// Envelope extraction
// ---------------------------------------------------------------------------

interface ExtractedSchemas {
  commands: FetchedSchema[]
  responses: FetchedSchema[]
  common: FetchedCommonSchema[]
  commonCommands: string[]
}

function applyEnvelopeExtraction(
  raw: {
    commands: FetchedSchema[]
    responses: FetchedSchema[]
    common: FetchedCommonSchema[]
  },
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
  const extractionErrors: string[] = []
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
      extractionErrors.push(formatExtractionError(cmdSchema.name, dataSchemaId))
      continue
    }

    resolvedCommands.push({
      name: cmdSchema.name,
      url: dataSchema.id,
      content: dataSchema.content,
    })
  }
  if (extractionErrors.length > 0) {
    throw new Error(
      `pull: ${extractionErrors.length} error(s) resolving envelope extractions:\n\n${extractionErrors.join('\n\n')}`,
    )
  }

  // Prune: walk resolved commands AND fetched responses, collect only the common
  // schemas they still reference. Responses must be included or their $refs
  // (e.g. a HAL collection embedding a HAL resource) drop out of the closure
  // and the bundler will reject them as unresolved.
  const referencedIds = new Set<string>()
  const resolvedSchemaIds = new Set<string>()
  for (const cmd of resolvedCommands) {
    const schema: JSONSchema7 = JSON.parse(cmd.content)
    if (typeof schema.$id === 'string') {
      resolvedSchemaIds.add(schema.$id)
    }
    collectRefs(schema, referencedIds)
  }
  for (const rsp of raw.responses) {
    const schema: JSONSchema7 = JSON.parse(rsp.content)
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

  return {
    commands: resolvedCommands,
    responses: raw.responses,
    common: prunedCommon,
    commonCommands,
  }
}

function warnOnCrossUrlUrnCollisions(raw: {
  commands: FetchedSchema[]
  responses: FetchedSchema[]
  common: FetchedCommonSchema[]
}): void {
  const urlsByUrn = new Map<string, Set<string>>()
  const record = (url: string, content: string): void => {
    let schema: JSONSchema7
    try {
      schema = JSON.parse(content) as JSONSchema7
    } catch {
      return
    }
    const urn = readCanonicalUrn(schema)
    if (urn === undefined) return
    let urls = urlsByUrn.get(urn)
    if (urls === undefined) {
      urls = new Set<string>()
      urlsByUrn.set(urn, urls)
    }
    urls.add(url)
  }
  for (const s of raw.commands) record(s.url, s.content)
  for (const s of raw.responses) record(s.url, s.content)
  for (const s of raw.common) record(s.id, s.content)
  for (const [urn, urls] of urlsByUrn) {
    if (urls.size <= 1) continue
    const lines = [...urls].map((u) => `  - ${u}`).join('\n')
    console.warn(
      `Warning: schema URN '${urn}' is served from ${urls.size} distinct URLs:\n${lines}`,
    )
  }
}

function readCanonicalUrn(schema: JSONSchema7): string | undefined {
  const svcUrn = (schema as Record<string, unknown>)['svc:urn']
  if (typeof svcUrn === 'string') return svcUrn
  if (typeof schema.$id === 'string') return schema.$id
  return undefined
}

function formatExtractionError(commandName: string, dataSchemaId: string): string {
  return [
    `  unresolved envelope extraction`,
    `    command: ${commandName}`,
    `    $id:     ${dataSchemaId}`,
    `    cause:   no schema with that $id was fetched (check the $ref target exists)`,
  ].join('\n')
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

// ---------------------------------------------------------------------------
// idReferences plumbing
// ---------------------------------------------------------------------------

interface CollectIdReferencesInput {
  commandIdReferencesByUrn: Map<string, IdReferenceEntry[]>
  repIdReferencesByUrn: Map<string, IdReferenceEntry[]>
  parsedCommands: Map<string, ParsedCommand>
  extractedCommands: FetchedSchema[]
  repResponseSchemas: Record<string, RepresentationResponseSchemas>
  repUrnByClassName: Map<string, string>
}

/**
 * Map per-command / per-rep idReferences from consumer config onto the
 * resolved schema URLs the bundler operates on.
 *
 * - For a command entry: paths apply to the command's resolved data schema
 *   (post-envelope-extraction) — keyed by that schema's URL.
 * - For a rep entry: paths apply to the rep's HAL resource response schema —
 *   keyed by that schema's URL.
 */
function collectIdReferences(input: CollectIdReferencesInput): IdReferencesForSchema[] {
  const out: IdReferencesForSchema[] = []

  // Commands: command URN → resolved data schema URL via parsedCommands + extractedCommands.
  // ParsedCommand has the command's name (the same key used in extractedCommands).
  const commandUrnToDataUrl = new Map<string, string>()
  for (const [name, parsed] of input.parsedCommands) {
    const extracted = input.extractedCommands.find((s) => s.name === name)
    if (extracted === undefined) continue
    commandUrnToDataUrl.set(parsed.urn, extracted.url)
  }
  for (const [cmdUrn, refs] of input.commandIdReferencesByUrn) {
    const url = commandUrnToDataUrl.get(cmdUrn)
    if (url === undefined) continue
    out.push({ urn: url, paths: refs })
  }

  // Reps: rep URN → HAL resource response schema URL.
  for (const [repUrn, refs] of input.repIdReferencesByUrn) {
    const className = findClassNameByRepUrn(input.repUrnByClassName, repUrn)
    if (className === undefined) continue
    const url = halResourceUrl(input.repResponseSchemas[className])
    if (url === undefined) continue
    out.push({ urn: url, paths: refs })
  }

  return out
}

function buildRepUrnByClassName(manifest: RepresentationManifest): Map<string, string> {
  const map = new Map<string, string>()
  for (const [className, surfaces] of Object.entries(manifest)) {
    map.set(className, surfaces.urn)
  }
  return map
}

function findClassNameByRepUrn(
  repUrnByClassName: Map<string, string>,
  repUrn: string,
): string | undefined {
  for (const [className, urn] of repUrnByClassName) {
    if (urn === repUrn) return className
  }
  return undefined
}

function halResourceUrl(responses: RepresentationResponseSchemas | undefined): string | undefined {
  const resource = responses?.resource
  if (!resource || resource.length === 0) return undefined
  const hal = resource.find((r) => r.contentType === HAL_CONTENT_TYPE)
  return (hal ?? resource[0])?.schemaUrl
}

/**
 * Mutate the rep manifest entries in place to attach `generatedIdReferences`
 * from each rep's consumer-config idReferences. Self-id entries (no
 * aggregateUrn / aggregateUrns) are filtered — they exist for codegen
 * typing only and have no runtime consumer.
 */
function populateGeneratedIdReferences(
  manifest: RepresentationManifest,
  repIdReferencesByUrn: Map<string, IdReferenceEntry[]>,
): void {
  for (const surfaces of Object.values(manifest)) {
    const refs = repIdReferencesByUrn.get(surfaces.urn)
    if (refs === undefined) continue
    const generated: GeneratedIdReference[] = []
    for (const ref of refs) {
      if (ref.kind === 'id') {
        if (ref.aggregateUrn === undefined) continue
        generated.push({ kind: 'id', path: ref.path, aggregateUrn: ref.aggregateUrn })
      } else {
        if (ref.aggregateUrns === undefined || ref.aggregateUrns.length === 0) continue
        generated.push({ kind: 'link', path: ref.path, aggregateUrns: ref.aggregateUrns })
      }
    }
    if (generated.length > 0) {
      surfaces.generatedIdReferences = generated
    }
  }
}
