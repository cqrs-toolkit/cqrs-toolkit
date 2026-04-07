/**
 * Discover all commands and representations from a served apidoc.jsonld.
 *
 * Unlike apidoc-parser.ts (which filters by requested URNs), this walks the
 * entire apidoc and returns everything — used by the `init` command.
 */

import type { HydraApiDocumentation } from '@cqrs-toolkit/hypermedia'
import assert from 'node:assert'

export interface DiscoveredCommand {
  /** Full command URN (e.g. 'urn:command:demo.CreateTodo:1.0.0') */
  urn: string
  /** Stable identifier without version (e.g. 'demo.CreateTodo') */
  stableId: string
  /** Semver version (e.g. '1.0.0') */
  version: string
}

export interface DiscoveredRepresentation {
  /** JSON-LD fragment @id (e.g. '#demo-todo-v1_0_0') */
  id: string
  /** Parent class name (e.g. 'demo:Todo') */
  className: string
  /** Semver version (e.g. '1.0.0') */
  version: string
}

export interface DiscoveryResult {
  commands: DiscoveredCommand[]
  representations: DiscoveredRepresentation[]
}

/**
 * Walk the entire apidoc and discover all commands and representations.
 */
export function discoverApidoc(apidoc: HydraApiDocumentation.Document): DiscoveryResult {
  const classes = apidoc['hydra:supportedClass']
  assert(Array.isArray(classes), 'apidoc must have hydra:supportedClass array')

  const commands: DiscoveredCommand[] = []
  const representations: DiscoveredRepresentation[] = []

  for (const cls of classes) {
    const className = cls['@id']

    // Discover commands
    const cmds = cls['svc:commands']
    if (cmds) {
      for (const cap of cmds['svc:supportedCommand']) {
        commands.push({
          urn: cap['@id'],
          stableId: cap['svc:stableId'],
          version: cap['schema:version'],
        })
      }
    }

    // Discover representations
    const reps = cls['svc:representation']
    if (Array.isArray(reps)) {
      for (const rep of reps) {
        representations.push({
          id: rep['@id'],
          className,
          version: rep['schema:version'],
        })
      }
    }
  }

  return { commands, representations }
}

/**
 * Group commands by stableId and pick the latest version of each.
 */
export function latestCommands(commands: DiscoveredCommand[]): DiscoveredCommand[] {
  const byStableId = new Map<string, DiscoveredCommand>()
  for (const cmd of commands) {
    const existing = byStableId.get(cmd.stableId)
    if (!existing || compareSemver(cmd.version, existing.version) > 0) {
      byStableId.set(cmd.stableId, cmd)
    }
  }
  return Array.from(byStableId.values())
}

/**
 * Group representations by className and pick the latest version of each.
 */
export function latestRepresentations(
  representations: DiscoveredRepresentation[],
): DiscoveredRepresentation[] {
  const byClass = new Map<string, DiscoveredRepresentation>()
  for (const rep of representations) {
    const existing = byClass.get(rep.className)
    if (!existing || compareSemver(rep.version, existing.version) > 0) {
      byClass.set(rep.className, rep)
    }
  }
  return Array.from(byClass.values())
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Simple semver comparison. Returns positive if a > b, negative if a < b, 0 if equal.
 */
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}
