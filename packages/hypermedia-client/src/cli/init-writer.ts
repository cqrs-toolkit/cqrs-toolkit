/**
 * Generate and update the cqrs-toolkit.config.ts file content (client section).
 */

import { Err, Exception, Ok, type Result } from '@meticoeus/ddd-es'
import {
  AST_NODE_TYPES,
  AST_TOKEN_TYPES,
  parse,
  simpleTraverse,
  type TSESTree,
} from '@typescript-eslint/typescript-estree'
import MagicString from 'magic-string'
import type { DiscoveredCommand, DiscoveredRepresentation } from './apidoc-discovery.js'
import { isObjectExpression, isStringLiteral } from './TSESTree.js'

// ---------------------------------------------------------------------------
// Formatting constants — match generateConfigFileContent() output
// ---------------------------------------------------------------------------

const QUOTE = "'"
/** Indentation for array entries inside `defineConfig({ client: { commands: [...] } })` */
const INDENT = '      '

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface InitWriterOptions {
  server: string
  apidocPath: string
  commands: DiscoveredCommand[]
  representations: DiscoveredRepresentation[]
}

interface UpdateChanges {
  added: string[]
  updated: Array<{ from: string; to: string }>
  removed: string[]
}

export type UpdateOp =
  | ({ kind: 'no-change' } & UpdateChanges)
  | ({ kind: 'updated'; updatedSource: string } & UpdateChanges)
  | ({ kind: 'bail'; reason: string } & UpdateChanges)

export class ParseValidationException extends Exception<{ mutatedSource: string }> {
  constructor(parseError: string, mutatedSource: string) {
    super('ParseValidationException', parseError)
    this._details = { mutatedSource }
  }
}

// ---------------------------------------------------------------------------
// Generate — fresh config file
// ---------------------------------------------------------------------------

/**
 * Generate valid TypeScript for the consumer's config file (fresh, no existing file).
 */
export function generateConfigFileContent(opts: InitWriterOptions): string {
  return `import { defineConfig } from '@cqrs-toolkit/hypermedia-cli/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  client: ${buildClientObjectContent(opts)},
})
`
}

/**
 * Override the `client` section in an existing config file, preserving all other
 * sections (e.g. `server`). If the `client` property doesn't exist, it is inserted.
 */
export function overrideClientSection(
  source: string,
  opts: InitWriterOptions,
): Result<string, ParseValidationException> {
  const ast = parse(source, { range: true, loc: true, tokens: true, comment: false })
  const tokens = ast.tokens ?? []

  const defineConfigArg = findDefineConfigArg(ast)
  if (!defineConfigArg) {
    return Err(
      new ParseValidationException(
        'Could not locate defineConfig() call with an object argument',
        source,
      ),
    )
  }

  const clientContent = buildClientObjectContent(opts)
  const s = new MagicString(source)

  const clientProp = findProperty(defineConfigArg, 'client')
  if (clientProp) {
    s.overwrite(clientProp.value.range[0], clientProp.value.range[1], clientContent)
  } else {
    const lastProp = defineConfigArg.properties[defineConfigArg.properties.length - 1]
    if (lastProp) {
      const afterLast = findTokenAfter(tokens, lastProp.range[1])
      const hasComma =
        afterLast && afterLast.type === AST_TOKEN_TYPES.Punctuator && afterLast.value === ','
      const insertPos = hasComma ? afterLast.range[1] : lastProp.range[1]
      if (!hasComma) {
        s.appendLeft(lastProp.range[1], ',')
      }
      s.appendLeft(insertPos, `\n  client: ${clientContent},`)
    } else {
      s.appendLeft(defineConfigArg.range[0] + 1, `\n  client: ${clientContent},\n`)
    }
  }

  return validateParse(s.toString())
}

function buildClientObjectContent(opts: InitWriterOptions): string {
  const NESTED = '      '
  const commandLines = opts.commands.map((c) => `${NESTED}${QUOTE}${c.urn}${QUOTE},`).join('\n')
  const repLines = opts.representations.map((r) => `${NESTED}${QUOTE}${r.id}${QUOTE},`).join('\n')

  return `{
    server: '${opts.server}',
    apidocPath: '${opts.apidocPath}',
    outputDir: path.resolve(__dirname, 'src/cqrs'),
    schemas: 'bundled',

    commands: [
${commandLines}
    ],

    representations: [
${repLines}
    ],
  }`
}

// ---------------------------------------------------------------------------
// Update — AST-based surgical update of the commands array
// ---------------------------------------------------------------------------

interface ExistingEntry {
  /** The opaque string value as written in the config file. */
  value: string
  node: TSESTree.Expression
  urnNode: TSESTree.StringLiteral
}

interface ReconciledCommand {
  currentUrn: string
  existingEntry?: ExistingEntry
  isNew: boolean
  urnChanged: boolean
}

/**
 * Update the `commands` array in an existing config file to match the discovered commands.
 * Returns an UpdateOp describing what changed.
 */
export function updateConfigCommands(
  source: string,
  allCommands: DiscoveredCommand[],
  latestCommands: DiscoveredCommand[],
): Result<UpdateOp, ParseValidationException> {
  const ast = parse(source, { range: true, loc: true, tokens: true, comment: false })
  const tokens = ast.tokens ?? []

  // Locate the defineConfig(...) call's object argument
  const configObject = findConfigObject(ast)
  if (!configObject) {
    return bail('Could not locate defineConfig() call with an object argument', [], [], [])
  }

  // Find the commands property
  const commandsProp = findProperty(configObject, 'commands')

  // Handle missing commands property
  if (!commandsProp) {
    return handleMissingCommandsProperty(source, configObject, tokens, latestCommands)
  }

  // Ensure value is an ArrayExpression
  if (commandsProp.value.type !== AST_NODE_TYPES.ArrayExpression) {
    return bail('commands property value is not an array literal', [], [], [])
  }

  const arrayNode = commandsProp.value

  // Handle empty array
  if (arrayNode.elements.length === 0) {
    return handleEmptyCommandsArray(source, arrayNode, latestCommands)
  }

  // Extract existing entries from the array
  const extractResult = extractExistingEntries(arrayNode)
  if (extractResult.kind === 'bail') {
    const reconResult = reconcileCommands(allCommands, latestCommands, extractResult.entries)
    return bail(
      'commands array contains entries that cannot be automatically updated',
      reconResult.added,
      reconResult.updated,
      reconResult.removed,
    )
  }

  const existingEntries = extractResult.entries

  // Reconcile against discovered commands
  const reconResult = reconcileCommands(allCommands, latestCommands, existingEntries)

  // Check for no changes
  if (
    reconResult.reconciled.every((r) => !r.isNew && !r.urnChanged) &&
    reconResult.removedEntries.length === 0
  ) {
    return Ok({
      kind: 'no-change' as const,
      added: [],
      updated: [],
      removed: [],
    })
  }

  // Apply mutations
  const s = new MagicString(source)

  // URN updates
  for (const rec of reconResult.reconciled) {
    if (rec.urnChanged && rec.existingEntry) {
      s.overwrite(
        rec.existingEntry.urnNode.range[0],
        rec.existingEntry.urnNode.range[1],
        `${QUOTE}${rec.currentUrn}${QUOTE}`,
      )
    }
  }

  // New entries — insert after nearest predecessor with an existingEntry
  const commaInserted = new Set<number>()
  for (const rec of reconResult.reconciled) {
    if (!rec.isNew) continue

    const predecessor = findPredecessorEntry(reconResult.reconciled, rec)
    const { position, needsComma } = resolveInsertionPosition(tokens, arrayNode, predecessor)
    if (needsComma && !commaInserted.has(position)) {
      s.appendLeft(position, ',')
      commaInserted.add(position)
    }
    s.appendLeft(position, `\n${INDENT}${QUOTE}${rec.currentUrn}${QUOTE},`)
  }

  // Removals
  if (reconResult.removedEntries.length === existingEntries.length) {
    // All elements removed — overwrite entire array with []
    s.overwrite(arrayNode.range[0], arrayNode.range[1], '[]')
  } else {
    for (const entry of reconResult.removedEntries) {
      const [start, end] = resolveRemovalRange(source, tokens, entry.node, arrayNode)
      s.remove(start, end)
    }
  }

  const updated = s.toString()

  // Re-parse gate
  const validated = validateParse(updated)
  if (!validated.ok) return validated

  return Ok({
    kind: 'updated' as const,
    updatedSource: updated,
    added: reconResult.added,
    updated: reconResult.updated,
    removed: reconResult.removed,
  })
}

// ---------------------------------------------------------------------------
// AST navigation
// ---------------------------------------------------------------------------

/** Find the object argument of the `defineConfig()` call. */
function findDefineConfigArg(ast: TSESTree.Program): TSESTree.ObjectExpression | undefined {
  let result: TSESTree.ObjectExpression | undefined
  simpleTraverse(ast, {
    enter(node) {
      if (
        node.type === AST_NODE_TYPES.CallExpression &&
        node.callee.type === AST_NODE_TYPES.Identifier &&
        node.callee.name === 'defineConfig' &&
        node.arguments.length > 0 &&
        node.arguments[0]?.type === AST_NODE_TYPES.ObjectExpression
      ) {
        result = node.arguments[0]
      }
    },
  })
  return result
}

/**
 * Find the `client` object inside the `defineConfig({ client: { ... } })` call.
 * Returns the inner object expression that contains `commands`, `representations`, etc.
 */
function findConfigObject(ast: TSESTree.Program): TSESTree.ObjectExpression | undefined {
  const arg = findDefineConfigArg(ast)
  if (!arg) return undefined
  const clientProp = findProperty(arg, 'client')
  if (clientProp && clientProp.value.type === AST_NODE_TYPES.ObjectExpression) {
    return clientProp.value
  }
  return undefined
}

function findProperty(obj: TSESTree.ObjectExpression, name: string): TSESTree.Property | undefined {
  for (const prop of obj.properties) {
    if (
      prop.type === AST_NODE_TYPES.Property &&
      prop.key.type === AST_NODE_TYPES.Identifier &&
      prop.key.name === name
    ) {
      return prop
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Entry extraction
// ---------------------------------------------------------------------------

interface ExtractSuccess {
  kind: 'ok'
  entries: ExistingEntry[]
}

interface ExtractBail {
  kind: 'bail'
  entries: ExistingEntry[]
}

function extractExistingEntries(arrayNode: TSESTree.ArrayExpression): ExtractSuccess | ExtractBail {
  const entries: ExistingEntry[] = []
  let hasBailEntry = false

  for (const element of arrayNode.elements) {
    if (!element) continue // sparse array hole

    switch (true) {
      case isStringLiteral(element): {
        entries.push({
          value: element.value,
          node: element,
          urnNode: element,
        })
        break
      }
      case isObjectExpression(element): {
        const urnProp = findObjectUrnProperty(element)
        if (urnProp) {
          entries.push({
            value: urnProp.value,
            node: element,
            urnNode: urnProp.node,
          })
        }
        break
      }
      case !!element:
        // Unrecognized element — bail
        hasBailEntry = true
        break
    }
  }

  return hasBailEntry ? { kind: 'bail', entries } : { kind: 'ok', entries }
}

function findObjectUrnProperty(
  obj: TSESTree.ObjectExpression,
): { value: string; node: TSESTree.StringLiteral } | undefined {
  for (const prop of obj.properties) {
    if (
      prop.type === AST_NODE_TYPES.Property &&
      prop.key.type === AST_NODE_TYPES.Identifier &&
      prop.key.name === 'urn' &&
      isStringLiteral(prop.value)
    ) {
      return { value: prop.value.value, node: prop.value }
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

interface ReconcileResult {
  reconciled: ReconciledCommand[]
  removedEntries: ExistingEntry[]
  added: string[]
  updated: Array<{ from: string; to: string }>
  removed: string[]
}

function reconcileCommands(
  allCommands: DiscoveredCommand[],
  latestCommands: DiscoveredCommand[],
  existing: ExistingEntry[],
): ReconcileResult {
  // Build lookups
  const allByUrn = new Map<string, DiscoveredCommand>()
  for (const cmd of allCommands) {
    allByUrn.set(cmd.urn, cmd)
  }
  const latestByStableId = new Map<string, DiscoveredCommand>()
  for (const cmd of latestCommands) {
    latestByStableId.set(cmd.stableId, cmd)
  }

  // Match existing entries to their stableId via allCommands lookup
  const existingByStableId = new Map<string, ExistingEntry>()
  const unmatchedExisting: ExistingEntry[] = []
  for (const entry of existing) {
    const discovered = allByUrn.get(entry.value)
    if (discovered) {
      existingByStableId.set(discovered.stableId, entry)
    } else {
      unmatchedExisting.push(entry)
    }
  }

  const reconciled: ReconciledCommand[] = []
  const added: string[] = []
  const updated: Array<{ from: string; to: string }> = []
  const matchedStableIds = new Set<string>()

  for (const latest of latestCommands) {
    const entry = existingByStableId.get(latest.stableId)
    if (entry) {
      matchedStableIds.add(latest.stableId)
      const urnChanged = entry.value !== latest.urn
      if (urnChanged) {
        updated.push({ from: entry.value, to: latest.urn })
      }
      reconciled.push({
        currentUrn: latest.urn,
        existingEntry: entry,
        isNew: false,
        urnChanged,
      })
    } else {
      added.push(latest.urn)
      reconciled.push({
        currentUrn: latest.urn,
        isNew: true,
        urnChanged: false,
      })
    }
  }

  // Existing entries not matched → removed
  const removedEntries: ExistingEntry[] = [...unmatchedExisting]
  const removed: string[] = unmatchedExisting.map((e) => e.value)
  for (const entry of existing) {
    const discovered = allByUrn.get(entry.value)
    if (discovered && !matchedStableIds.has(discovered.stableId)) {
      removedEntries.push(entry)
      removed.push(entry.value)
    }
  }

  return { reconciled, removedEntries, added, updated, removed }
}

// ---------------------------------------------------------------------------
// Insertion helpers
// ---------------------------------------------------------------------------

function findPredecessorEntry(
  reconciled: ReconciledCommand[],
  target: ReconciledCommand,
): ExistingEntry | undefined {
  const idx = reconciled.indexOf(target)
  for (let i = idx - 1; i >= 0; i--) {
    const prev = reconciled[i]
    if (prev?.existingEntry) return prev.existingEntry
  }
  return undefined
}

interface InsertionPoint {
  position: number
  needsComma: boolean
}

function resolveInsertionPosition(
  tokens: TSESTree.Token[],
  arrayNode: TSESTree.ArrayExpression,
  predecessor: ExistingEntry | undefined,
): InsertionPoint {
  if (predecessor) {
    const afterNode = findTokenAfter(tokens, predecessor.node.range[1])
    if (afterNode && afterNode.type === AST_TOKEN_TYPES.Punctuator && afterNode.value === ',') {
      return { position: afterNode.range[1], needsComma: false }
    }
    return { position: predecessor.node.range[1], needsComma: true }
  }
  return { position: arrayNode.range[0] + 1, needsComma: false }
}

// ---------------------------------------------------------------------------
// Removal helpers
// ---------------------------------------------------------------------------

function resolveRemovalRange(
  source: string,
  tokens: TSESTree.Token[],
  node: TSESTree.Expression,
  arrayNode: TSESTree.ArrayExpression,
): [number, number] {
  // End: consume trailing comma if present, otherwise stop at element end
  const afterToken = findTokenAfter(tokens, node.range[1])
  const hasTrailingComma =
    afterToken && afterToken.type === AST_TOKEN_TYPES.Punctuator && afterToken.value === ','
  const end = hasTrailingComma ? afterToken.range[1] : node.range[1]

  // Start: scan backward from element, consuming whitespace and at most one \n
  const start = scanBackwardWhitespace(source, node.range[0], arrayNode.range[0] + 1)

  return [start, end]
}

/**
 * Scan backward from `from`, consuming spaces/tabs and at most one newline.
 * Stops at `boundary` (exclusive — will not consume characters before boundary).
 */
function scanBackwardWhitespace(source: string, from: number, boundary: number): number {
  let pos = from - 1
  // Consume spaces and tabs
  while (pos >= boundary && (source[pos] === ' ' || source[pos] === '\t')) {
    pos--
  }
  // Consume at most one newline
  if (pos >= boundary && source[pos] === '\n') {
    pos--
  }
  return pos + 1
}

// ---------------------------------------------------------------------------
// Missing/empty property handlers
// ---------------------------------------------------------------------------

function handleMissingCommandsProperty(
  source: string,
  configObject: TSESTree.ObjectExpression,
  tokens: TSESTree.Token[],
  discoveredCommands: DiscoveredCommand[],
): Result<UpdateOp, ParseValidationException> {
  if (discoveredCommands.length === 0) {
    return Ok({ kind: 'no-change' as const, added: [], updated: [], removed: [] })
  }

  const commandLines = discoveredCommands
    .map((c) => `${INDENT}${QUOTE}${c.urn}${QUOTE},`)
    .join('\n')
  const propertyBlock = `\n    commands: [\n${commandLines}\n    ],\n`

  const s = new MagicString(source)

  // Find insertion point: before representations property, or before closing }
  const repsProp = findProperty(configObject, 'representations')
  if (repsProp) {
    // Ensure the property before representations has a trailing comma
    const tokenBeforeReps = findTokenBefore(tokens, repsProp.range[0])
    if (tokenBeforeReps && tokenBeforeReps.value !== ',' && tokenBeforeReps.value !== '{') {
      s.appendLeft(tokenBeforeReps.range[1], ',')
    }
    s.appendLeft(repsProp.range[0], propertyBlock)
  } else {
    const closingBrace = findTokenBefore(tokens, configObject.range[1])
    if (closingBrace && closingBrace.value === '}') {
      // Ensure the last property has a trailing comma
      const tokenBeforeBrace = findTokenBefore(tokens, closingBrace.range[0])
      if (tokenBeforeBrace && tokenBeforeBrace.value !== ',' && tokenBeforeBrace.value !== '{') {
        s.appendLeft(tokenBeforeBrace.range[1], ',')
      }
      s.appendLeft(closingBrace.range[0], propertyBlock)
    } else {
      s.appendLeft(configObject.range[1] - 1, propertyBlock)
    }
  }

  const validated = validateParse(s.toString())
  if (!validated.ok) return validated

  return Ok({
    kind: 'updated' as const,
    updatedSource: validated.value,
    added: discoveredCommands.map((c) => c.urn),
    updated: [],
    removed: [],
  })
}

function handleEmptyCommandsArray(
  source: string,
  arrayNode: TSESTree.ArrayExpression,
  discoveredCommands: DiscoveredCommand[],
): Result<UpdateOp, ParseValidationException> {
  return handleEmptyArray(
    source,
    arrayNode,
    discoveredCommands.map((c) => c.urn),
  )
}

// ---------------------------------------------------------------------------
// Re-parse gate
// ---------------------------------------------------------------------------

function validateParse(source: string): Result<string, ParseValidationException> {
  try {
    parse(source, { range: false, loc: false })
    return Ok(source)
  } catch (err) {
    return Err(
      new ParseValidationException(err instanceof Error ? err.message : String(err), source),
    )
  }
}

// ---------------------------------------------------------------------------
// Bail result
// ---------------------------------------------------------------------------

function bail(
  reason: string,
  added: string[],
  updated: Array<{ from: string; to: string }>,
  removed: string[],
): Result<UpdateOp, ParseValidationException> {
  return Ok({ kind: 'bail' as const, reason, added, updated, removed })
}

// ---------------------------------------------------------------------------
// Update — AST-based surgical update of the representations array
// ---------------------------------------------------------------------------

interface ExistingRepEntry {
  id: string
  node: TSESTree.StringLiteral
}

interface ReconciledRep {
  currentId: string
  existingEntry?: ExistingRepEntry
  isNew: boolean
  idChanged: boolean
}

/**
 * Update the `representations` array in an existing config file to match the
 * discovered representations.
 *
 * @param allRepresentations All representations discovered from the apidoc (all versions)
 * @param latestRepresentations The latest representation per hydra class
 */
export function updateConfigRepresentations(
  source: string,
  allRepresentations: DiscoveredRepresentation[],
  latestRepresentations: DiscoveredRepresentation[],
): Result<UpdateOp, ParseValidationException> {
  const ast = parse(source, { range: true, loc: true, tokens: true, comment: false })
  const tokens = ast.tokens ?? []

  const configObject = findConfigObject(ast)
  if (!configObject) {
    return bail('Could not locate defineConfig() call with an object argument', [], [], [])
  }

  const repsProp = findProperty(configObject, 'representations')

  if (!repsProp) {
    return handleMissingRepresentationsProperty(source, configObject, tokens, latestRepresentations)
  }

  if (repsProp.value.type !== AST_NODE_TYPES.ArrayExpression) {
    return bail('representations property value is not an array literal', [], [], [])
  }

  const arrayNode = repsProp.value

  if (arrayNode.elements.length === 0) {
    return handleEmptyArray(
      source,
      arrayNode,
      latestRepresentations.map((r) => r.id),
    )
  }

  // Extract existing entries — representations are always string literals
  const existingEntries: ExistingRepEntry[] = []
  let hasBailEntry = false
  for (const element of arrayNode.elements) {
    if (!element) continue
    if (isStringLiteral(element)) {
      existingEntries.push({ id: element.value, node: element })
      continue
    }
    hasBailEntry = true
  }

  // Reconcile
  const reconResult = reconcileRepresentations(
    allRepresentations,
    latestRepresentations,
    existingEntries,
  )

  if (hasBailEntry) {
    return bail(
      'representations array contains entries that cannot be automatically updated',
      reconResult.added,
      reconResult.updated,
      reconResult.removed,
    )
  }

  // Check for no changes
  if (
    reconResult.reconciled.every((r) => !r.isNew && !r.idChanged) &&
    reconResult.removedEntries.length === 0
  ) {
    return Ok({ kind: 'no-change' as const, added: [], updated: [], removed: [] })
  }

  // Apply mutations
  const s = new MagicString(source)

  for (const rec of reconResult.reconciled) {
    if (rec.idChanged && rec.existingEntry) {
      s.overwrite(
        rec.existingEntry.node.range[0],
        rec.existingEntry.node.range[1],
        `${QUOTE}${rec.currentId}${QUOTE}`,
      )
    }
  }

  const repCommaInserted = new Set<number>()
  for (const rec of reconResult.reconciled) {
    if (!rec.isNew) continue
    const predecessor = findRepPredecessorEntry(reconResult.reconciled, rec)
    const { position, needsComma } = resolveRepInsertionPosition(tokens, arrayNode, predecessor)
    if (needsComma && !repCommaInserted.has(position)) {
      s.appendLeft(position, ',')
      repCommaInserted.add(position)
    }
    s.appendLeft(position, `\n${INDENT}${QUOTE}${rec.currentId}${QUOTE},`)
  }

  if (reconResult.removedEntries.length === existingEntries.length) {
    s.overwrite(arrayNode.range[0], arrayNode.range[1], '[]')
  } else {
    for (const entry of reconResult.removedEntries) {
      const [start, end] = resolveRemovalRange(source, tokens, entry.node, arrayNode)
      s.remove(start, end)
    }
  }

  const validated = validateParse(s.toString())
  if (!validated.ok) return validated

  return Ok({
    kind: 'updated' as const,
    updatedSource: validated.value,
    added: reconResult.added,
    updated: reconResult.updated,
    removed: reconResult.removed,
  })
}

// ---------------------------------------------------------------------------
// Representation reconciliation
// ---------------------------------------------------------------------------

interface RepReconcileResult {
  reconciled: ReconciledRep[]
  removedEntries: ExistingRepEntry[]
  added: string[]
  updated: Array<{ from: string; to: string }>
  removed: string[]
}

function reconcileRepresentations(
  allReps: DiscoveredRepresentation[],
  latestReps: DiscoveredRepresentation[],
  existing: ExistingRepEntry[],
): RepReconcileResult {
  // Build lookups
  const allById = new Map<string, DiscoveredRepresentation>()
  for (const rep of allReps) {
    allById.set(rep.id, rep)
  }
  const latestByClass = new Map<string, DiscoveredRepresentation>()
  for (const rep of latestReps) {
    latestByClass.set(rep.className, rep)
  }

  // Match existing entries to their className via allReps lookup
  const existingByClass = new Map<string, ExistingRepEntry>()
  const unmatchedExisting: ExistingRepEntry[] = []
  for (const entry of existing) {
    const discovered = allById.get(entry.id)
    if (discovered) {
      existingByClass.set(discovered.className, entry)
    } else {
      unmatchedExisting.push(entry)
    }
  }

  const reconciled: ReconciledRep[] = []
  const added: string[] = []
  const updated: Array<{ from: string; to: string }> = []
  const matchedClasses = new Set<string>()

  for (const latest of latestReps) {
    const entry = existingByClass.get(latest.className)
    if (entry) {
      matchedClasses.add(latest.className)
      const idChanged = entry.id !== latest.id
      if (idChanged) {
        updated.push({ from: entry.id, to: latest.id })
      }
      reconciled.push({
        currentId: latest.id,
        existingEntry: entry,
        isNew: false,
        idChanged,
      })
    } else {
      added.push(latest.id)
      reconciled.push({
        currentId: latest.id,
        isNew: true,
        idChanged: false,
      })
    }
  }

  // Existing entries not matched → removed
  const removedEntries: ExistingRepEntry[] = [...unmatchedExisting]
  const removed: string[] = unmatchedExisting.map((e) => e.id)
  for (const entry of existing) {
    const discovered = allById.get(entry.id)
    if (discovered && !matchedClasses.has(discovered.className)) {
      removedEntries.push(entry)
      removed.push(entry.id)
    }
  }

  return { reconciled, removedEntries, added, updated, removed }
}

function findRepPredecessorEntry(
  reconciled: ReconciledRep[],
  target: ReconciledRep,
): ExistingRepEntry | undefined {
  const idx = reconciled.indexOf(target)
  for (let i = idx - 1; i >= 0; i--) {
    const prev = reconciled[i]
    if (prev?.existingEntry) return prev.existingEntry
  }
  return undefined
}

function resolveRepInsertionPosition(
  tokens: TSESTree.Token[],
  arrayNode: TSESTree.ArrayExpression,
  predecessor: ExistingRepEntry | undefined,
): InsertionPoint {
  if (predecessor) {
    const afterNode = findTokenAfter(tokens, predecessor.node.range[1])
    if (afterNode && afterNode.type === AST_TOKEN_TYPES.Punctuator && afterNode.value === ',') {
      return { position: afterNode.range[1], needsComma: false }
    }
    return { position: predecessor.node.range[1], needsComma: true }
  }
  return { position: arrayNode.range[0] + 1, needsComma: false }
}

// ---------------------------------------------------------------------------
// Missing/empty representations handler
// ---------------------------------------------------------------------------

function handleMissingRepresentationsProperty(
  source: string,
  configObject: TSESTree.ObjectExpression,
  tokens: TSESTree.Token[],
  latestRepresentations: DiscoveredRepresentation[],
): Result<UpdateOp, ParseValidationException> {
  if (latestRepresentations.length === 0) {
    return Ok({ kind: 'no-change' as const, added: [], updated: [], removed: [] })
  }

  const repLines = latestRepresentations.map((r) => `${INDENT}${QUOTE}${r.id}${QUOTE},`).join('\n')
  const propertyBlock = `\n    representations: [\n${repLines}\n    ],\n`

  const s = new MagicString(source)

  // Insert after commands property, or before closing }
  const commandsProp = findProperty(configObject, 'commands')
  if (commandsProp) {
    // Find the end of the commands property (value + optional trailing comma)
    const afterValue = findTokenAfter(tokens, commandsProp.value.range[1])
    let insertPos: number
    if (afterValue && afterValue.type === AST_TOKEN_TYPES.Punctuator && afterValue.value === ',') {
      insertPos = afterValue.range[1]
    } else {
      // No trailing comma — add one
      s.appendLeft(commandsProp.value.range[1], ',')
      insertPos = commandsProp.value.range[1]
    }
    s.appendLeft(insertPos, propertyBlock)
  } else {
    const closingBrace = findTokenBefore(tokens, configObject.range[1])
    if (closingBrace && closingBrace.value === '}') {
      // Ensure the last property has a trailing comma
      const tokenBeforeBrace = findTokenBefore(tokens, closingBrace.range[0])
      if (tokenBeforeBrace && tokenBeforeBrace.value !== ',' && tokenBeforeBrace.value !== '{') {
        s.appendLeft(tokenBeforeBrace.range[1], ',')
      }
      s.appendLeft(closingBrace.range[0], propertyBlock)
    } else {
      s.appendLeft(configObject.range[1] - 1, propertyBlock)
    }
  }

  const validated = validateParse(s.toString())
  if (!validated.ok) return validated

  return Ok({
    kind: 'updated' as const,
    updatedSource: validated.value,
    added: latestRepresentations.map((r) => r.id),
    updated: [],
    removed: [],
  })
}

// ---------------------------------------------------------------------------
// Shared empty-array handler
// ---------------------------------------------------------------------------

function handleEmptyArray(
  source: string,
  arrayNode: TSESTree.ArrayExpression,
  values: string[],
): Result<UpdateOp, ParseValidationException> {
  if (values.length === 0) {
    return Ok({ kind: 'no-change' as const, added: [], updated: [], removed: [] })
  }

  const lines = values.map((v) => `${INDENT}${QUOTE}${v}${QUOTE},`).join('\n')
  const arrayBody = `[\n${lines}\n  ]`

  const s = new MagicString(source)
  s.overwrite(arrayNode.range[0], arrayNode.range[1], arrayBody)

  const validated = validateParse(s.toString())
  if (!validated.ok) return validated

  return Ok({
    kind: 'updated' as const,
    updatedSource: validated.value,
    added: values,
    updated: [],
    removed: [],
  })
}

// ---------------------------------------------------------------------------
// Token stream helpers
// ---------------------------------------------------------------------------

function findTokenAfter(tokens: TSESTree.Token[], position: number): TSESTree.Token | undefined {
  return tokens.find((t) => t.range[0] >= position)
}

function findTokenBefore(tokens: TSESTree.Token[], position: number): TSESTree.Token | undefined {
  let result: TSESTree.Token | undefined
  for (const t of tokens) {
    if (t.range[1] <= position) {
      result = t
    } else {
      break
    }
  }
  return result
}
