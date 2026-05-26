/**
 * Config validation and resolution for `cqrs-toolkit client` commands.
 */

import { isAbsolute } from 'node:path'
import type { PullConfig } from '../config.js'

/**
 * Validate a raw PullConfig.
 * Throws on invalid config.
 */
export function resolveConfig(rawConfig: PullConfig): PullConfig {
  validateConfig(rawConfig)
  return rawConfig
}

function validateConfig(config: unknown): asserts config is PullConfig {
  if (typeof config !== 'object' || config === null) {
    throw new Error(`Client config must be an object`)
  }
  const c = config as Record<string, unknown>
  if (typeof c['server'] !== 'string') {
    throw new Error(`Config 'client.server' must be a string`)
  }
  if (typeof c['apidocPath'] !== 'string') {
    throw new Error(`Config 'client.apidocPath' must be a string`)
  }
  if (!Array.isArray(c['commands']) || c['commands'].length === 0) {
    throw new Error(`Config 'client.commands' must be a non-empty array of URN strings or entries`)
  }
  if (!Array.isArray(c['representations'])) {
    throw new Error(`Config 'client.representations' must be an array of URN strings or entries`)
  }
  if (typeof c['outputDir'] !== 'string') {
    throw new Error(`Config 'client.outputDir' must be a string`)
  }
  if (!isAbsolute(c['outputDir'])) {
    throw new Error(
      `Config 'client.outputDir' must be an absolute path. Use path.resolve(__dirname, '...') in your config.`,
    )
  }
  validateLinkType(c)
  validateCodegen(c)
  validateIdReferencesOnEntries(c)
}

function validateCodegen(c: Record<string, unknown>): void {
  const codegen = c['codegen']
  if (codegen === undefined) return
  if (typeof codegen !== 'object' || codegen === null) {
    throw new Error(`Config 'client.codegen' must be an object`)
  }
  const cc = codegen as Record<string, unknown>
  const derive = cc['deriveTypeName']
  if (derive !== undefined && typeof derive !== 'function') {
    throw new Error(`Config 'client.codegen.deriveTypeName' must be a function`)
  }
}

function validateLinkType(c: Record<string, unknown>): void {
  const linkType = c['linkType']
  if (linkType !== undefined && linkType !== 'Link' && linkType !== 'ServiceLink') {
    throw new Error(`Config 'client.linkType' must be 'Link' or 'ServiceLink'`)
  }
}

function validateIdReferencesOnEntries(c: Record<string, unknown>): void {
  const linkType = c['linkType']
  let hasLinkEntry = false
  for (const entry of c['commands'] as unknown[]) {
    if (typeof entry === 'string') continue
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Each 'client.commands' entry must be a string or an object`)
    }
    hasLinkEntry =
      validateIdReferencesField(entry as Record<string, unknown>, 'command') || hasLinkEntry
  }
  for (const entry of c['representations'] as unknown[]) {
    if (typeof entry === 'string') continue
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Each 'client.representations' entry must be a string or an object`)
    }
    hasLinkEntry =
      validateIdReferencesField(entry as Record<string, unknown>, 'representation') || hasLinkEntry
  }
  if (hasLinkEntry && linkType === undefined) {
    throw new Error(
      `Config 'client.linkType' is required when any entry has an 'idReferences' kind: 'link' ` +
        `(set it to 'Link' or 'ServiceLink')`,
    )
  }
}

/**
 * Validate the `idReferences` field on a single command/rep entry. Returns
 * whether any link-kind entry was seen so the caller can require linkType.
 */
function validateIdReferencesField(
  entry: Record<string, unknown>,
  kindLabel: 'command' | 'representation',
): boolean {
  if (typeof entry['urn'] !== 'string') {
    throw new Error(`Each '${kindLabel}' entry needs a string 'urn'`)
  }
  const refs = entry['idReferences']
  if (refs === undefined) return false
  if (!Array.isArray(refs)) {
    throw new Error(`${kindLabel} '${entry['urn']}': 'idReferences' must be an array`)
  }
  let hasLink = false
  for (const ref of refs) {
    if (typeof ref !== 'object' || ref === null) {
      throw new Error(`${kindLabel} '${entry['urn']}': each idReferences entry must be an object`)
    }
    const r = ref as Record<string, unknown>
    if (r['kind'] !== 'id' && r['kind'] !== 'link') {
      throw new Error(
        `${kindLabel} '${entry['urn']}': idReferences entry kind must be 'id' or 'link' ` +
          `(got ${JSON.stringify(r['kind'])})`,
      )
    }
    if (typeof r['path'] !== 'string') {
      throw new Error(`${kindLabel} '${entry['urn']}': idReferences entry needs a string 'path'`)
    }
    if (
      r['kind'] === 'id' &&
      r['aggregateUrn'] !== undefined &&
      typeof r['aggregateUrn'] !== 'string'
    ) {
      throw new Error(
        `${kindLabel} '${entry['urn']}': idReferences 'aggregateUrn' must be a string`,
      )
    }
    if (r['kind'] === 'link') {
      hasLink = true
      const urns = r['aggregateUrns']
      if (urns !== undefined && (!Array.isArray(urns) || urns.some((u) => typeof u !== 'string'))) {
        throw new Error(
          `${kindLabel} '${entry['urn']}': idReferences 'aggregateUrns' must be an array of strings`,
        )
      }
    }
  }
  return hasLink
}
