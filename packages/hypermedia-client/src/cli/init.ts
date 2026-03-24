/**
 * CLI `init` command — discover commands and representations from the apidoc
 * and write a cqrs-hypermedia.config.ts file.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { discoverApidoc, latestCommands, latestRepresentations } from './apidoc-discovery.js'
import {
  generateConfigFileContent,
  type ParseValidationException,
  updateConfigCommands,
  updateConfigRepresentations,
  type UpdateOp,
} from './init-writer.js'

type ConflictResolution = 'abort' | 'update' | 'override'

const CONFIG_FILENAMES = [
  'cqrs-hypermedia.config.ts',
  'cqrs-hypermedia.config.js',
  'cqrs-hypermedia.config.mjs',
]

export interface InitOptions {
  server: string
  apidocPath: string
  conflict?: ConflictResolution
}

export async function init(projectRoot: string, opts: InitOptions): Promise<void> {
  const apidocUrl = `${opts.server}${opts.apidocPath}`

  // Check for existing config file
  const existingConfigPath = findExistingConfig(projectRoot)

  if (existingConfigPath) {
    const resolution = opts.conflict ?? (await promptConflictResolution(existingConfigPath))

    switch (resolution) {
      case 'abort':
        console.log('Aborted. Existing config file unchanged.')
        return
      case 'update':
        await runUpdate(existingConfigPath, apidocUrl)
        return
      case 'override':
        // Fall through to the write-from-scratch path below
        break
    }
  }

  // Fetch apidoc and write a fresh config file
  console.log(`Fetching apidoc from ${apidocUrl}`)
  const res = await fetch(apidocUrl)
  if (!res.ok) {
    throw new Error(`Failed to fetch apidoc: ${res.status} ${res.statusText}`)
  }
  const apidoc: unknown = await res.json()

  const discovery = discoverApidoc(apidoc)
  const commands = latestCommands(discovery.commands)
  const representations = latestRepresentations(discovery.representations)

  console.log(`Discovered ${discovery.commands.length} command(s), ${commands.length} latest`)
  console.log(
    `Discovered ${discovery.representations.length} representation(s), ${representations.length} latest`,
  )

  const content = generateConfigFileContent({
    server: opts.server,
    apidocPath: opts.apidocPath,
    commands,
    representations,
  })

  const configPath = existingConfigPath ?? join(projectRoot, 'cqrs-hypermedia.config.ts')
  writeFileSync(configPath, content)
  console.log(`\nWrote ${configPath}`)
  console.log("Edit this file to remove commands/representations you don't need.")
}

// ---------------------------------------------------------------------------
// Update path
// ---------------------------------------------------------------------------

async function runUpdate(configPath: string, apidocUrl: string): Promise<void> {
  console.log(`Fetching apidoc from ${apidocUrl}`)
  const res = await fetch(apidocUrl)
  if (!res.ok) {
    throw new Error(`Failed to fetch apidoc: ${res.status} ${res.statusText}`)
  }
  const apidoc: unknown = await res.json()

  const discovery = discoverApidoc(apidoc)
  const commands = latestCommands(discovery.commands)
  const reps = latestRepresentations(discovery.representations)

  console.log(`Discovered ${discovery.commands.length} command(s), ${commands.length} latest`)
  console.log(
    `Discovered ${discovery.representations.length} representation(s), ${reps.length} latest`,
  )

  const originalSource = readFileSync(configPath, 'utf8')

  // Update commands
  const cmdResult = updateConfigCommands(originalSource, discovery.commands, commands)
  if (!cmdResult.ok) {
    logParseValidationError('commands', cmdResult.error)
    return
  }
  const cmdOp = cmdResult.value
  const afterCommands = cmdOp.kind === 'updated' ? cmdOp.updatedSource : originalSource

  // Update representations
  const repResult = updateConfigRepresentations(afterCommands, discovery.representations, reps)
  if (!repResult.ok) {
    logParseValidationError('representations', repResult.error)
    return
  }
  const repOp = repResult.value
  const finalSource = repOp.kind === 'updated' ? repOp.updatedSource : afterCommands

  // Determine if anything changed
  const cmdChanged = cmdOp.kind === 'updated'
  const repChanged = repOp.kind === 'updated'

  if (!cmdChanged && !repChanged) {
    console.log('Config is already up to date.')
    return
  }

  writeFileSync(configPath, finalSource)
  console.log(`\nUpdated ${configPath}`)
  if (cmdOp.kind === 'bail') {
    logBail('command', cmdOp)
  } else if (cmdChanged) {
    logChangeSummary('command', cmdOp)
  }
  if (repOp.kind === 'bail') {
    logBail('representation', repOp)
  } else if (repChanged) {
    logChangeSummary('representation', repOp)
  }
}

function logParseValidationError(label: string, err: ParseValidationException): void {
  console.error(`Failed to update ${label}: mutated config is not valid TypeScript.`)
  console.error(err.message)
  console.error('--- mutated content ---')
  console.error(err.details?.mutatedSource)
}

function logBail(label: string, op: Extract<UpdateOp, { kind: 'bail' }>): void {
  console.warn(`Warning: ${op.reason}.`)
  logChangeSummary(label, op)
  if (op.updated.length > 0 || op.added.length > 0 || op.removed.length > 0) {
    console.warn('Apply these manually or re-run with override mode.')
  }
}

function logChangeSummary(label: string, op: UpdateOp): void {
  if (op.updated.length > 0) {
    console.log(`  Updated ${op.updated.length} ${label}(s):`)
    for (const u of op.updated) {
      console.log(`    ${u.from} → ${u.to}`)
    }
  }
  if (op.added.length > 0) {
    console.log(`  Added ${op.added.length} ${label}(s):`)
    for (const a of op.added) {
      console.log(`    ${a}`)
    }
  }
  if (op.removed.length > 0) {
    console.log(`  ⚠ Removed ${op.removed.length} ${label}(s) — no longer present in apidoc:`)
    for (const r of op.removed) {
      console.log(`    ${r}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Config file detection
// ---------------------------------------------------------------------------

function findExistingConfig(projectRoot: string): string | undefined {
  for (const name of CONFIG_FILENAMES) {
    const candidate = join(projectRoot, name)
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Interactive prompt
// ---------------------------------------------------------------------------

function promptConflictResolution(configPath: string): Promise<ConflictResolution> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })

    console.log(`\nConfig file already exists: ${configPath}`)
    console.log('  [a] abort — keep existing file (default)')
    console.log('  [u] update — add new commands, preserve config')
    console.log('  [o] override — rewrite file from scratch')

    rl.question('> ', (answer) => {
      rl.close()
      const normalized = answer.trim().toLowerCase()
      switch (normalized) {
        case 'u':
        case 'update':
          resolve('update')
          break
        case 'o':
        case 'override':
          resolve('override')
          break
        default:
          resolve('abort')
          break
      }
    })
  })
}
