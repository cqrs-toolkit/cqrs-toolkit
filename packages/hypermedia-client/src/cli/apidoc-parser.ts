/**
 * Parse a served apidoc.jsonld and extract command routing information.
 */

import type { HydraApiDocumentation } from '@cqrs-toolkit/hypermedia'
import assert from 'node:assert'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TemplateMapping {
  /** URL template variable name (e.g. 'id') */
  variable: string
  /** Whether the mapping is required */
  required: boolean
}

export interface ParsedResponseSchema {
  /** Media type (e.g. 'application/json') */
  contentType: string
  /** Full URL to the JSON schema (already resolved in served apidoc) */
  schemaUrl: string
}

export interface ParsedCommand {
  /** Full command URN (e.g. 'urn:command:chat.CreateMessage:1.0.0') */
  urn: string
  /** Dispatch key linking to a command surface ('create', 'command', etc.). Absent for custom-surface commands. */
  dispatch?: string
  /** Command type discriminator for envelope-style endpoints (absent for 'create') */
  commandType?: string
  /** Resolved URI template (e.g. '/api/chat/messages/{id}/command') */
  template: string
  /** Template variable mappings */
  mappings: TemplateMapping[]
  /** Full URL to the JSON schema (already resolved in served apidoc) */
  schemaUrl?: string
  /** Per-content-type response schemas, read from apidoc */
  responseSchema?: ParsedResponseSchema[]
  /** Workflow annotation from apidoc */
  workflow?: { type: string; nextStepId?: string }
}

export interface ParseResult {
  /** Successfully matched commands keyed by derived command name */
  commands: Map<string, ParsedCommand>
  /** URNs from config that were not found in the apidoc */
  missing: string[]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a served apidoc.jsonld and extract routing info for the requested command URNs.
 */
export function parseApidoc(
  apidoc: HydraApiDocumentation.Document,
  requestedUrns: string[],
): ParseResult {
  const classes = apidoc['hydra:supportedClass']
  assert(Array.isArray(classes), 'apidoc must have hydra:supportedClass array')

  const requested = new Set(requestedUrns)
  const commands = new Map<string, ParsedCommand>()
  const found = new Set<string>()

  for (const cls of classes) {
    const cmds = cls['svc:commands']
    if (!cmds) continue

    const surfacesByDispatch = indexSurfaces(cmds['svc:commandSurfaces'])

    for (const cap of cmds['svc:supportedCommand']) {
      const urn = cap['@id']
      if (!requested.has(urn)) continue
      found.add(urn)

      const dispatch = cap['svc:dispatch']
      const surface = cap['svc:surface']
        ? resolveCustomSurface(cap['svc:surface'])
        : resolveSharedSurface(surfacesByDispatch, dispatch, urn)

      const name = cap['svc:stableId']
      const parsed: ParsedCommand = {
        urn,
        dispatch,
        template: surface.template,
        mappings: surface.mappings,
        schemaUrl: cap['svc:jsonSchema'],
      }
      if (cap['svc:responseSchema']?.length) {
        parsed.responseSchema = cap['svc:responseSchema'].map((rs) => ({
          contentType: rs['svc:contentType'],
          schemaUrl: rs['svc:jsonSchema'],
        }))
      }
      if (cap['svc:workflow']) {
        const w = cap['svc:workflow']
        parsed.workflow = {
          type: w['@type'],
          ...(w['svc:nextStep'] ? { nextStepId: w['svc:nextStep']['@id'] } : {}),
        }
      }
      if (cap['svc:commandType']) {
        parsed.commandType = cap['svc:commandType']
      }
      commands.set(name, parsed)
    }
  }

  const missing = requestedUrns.filter((urn) => !found.has(urn))
  return { commands, missing }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

interface ResolvedSurface {
  template: string
  mappings: TemplateMapping[]
}

function indexSurfaces(
  surfaces: HydraApiDocumentation.CommandSurface[],
): Map<string, HydraApiDocumentation.CommandSurface> {
  const map = new Map<string, HydraApiDocumentation.CommandSurface>()
  for (const s of surfaces) {
    assert(s['svc:dispatch'], 'Shared command surface missing svc:dispatch')
    map.set(s['svc:dispatch'], s)
  }
  return map
}

function resolveSharedSurface(
  index: Map<string, HydraApiDocumentation.CommandSurface>,
  dispatch: string | undefined,
  urn: string,
): ResolvedSurface {
  assert(dispatch, `Command ${urn} has no dispatch and no custom surface`)
  const surface = index.get(dispatch)
  assert(surface, `No command surface with dispatch '${dispatch}' for ${urn}`)
  return resolveTemplate(surface['svc:template'])
}

function resolveCustomSurface(surface: HydraApiDocumentation.CommandSurface): ResolvedSurface {
  return resolveTemplate(surface['svc:template'])
}

function resolveTemplate(tpl: HydraApiDocumentation.IriTemplate): ResolvedSurface {
  return {
    template: tpl['hydra:template'],
    mappings: tpl['hydra:mapping'].map((m) => ({
      variable: m['hydra:variable'],
      required: m['hydra:required'] ?? false,
    })),
  }
}
