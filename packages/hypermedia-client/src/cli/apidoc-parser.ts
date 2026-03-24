/**
 * Parse a served apidoc.jsonld and extract command routing information.
 */

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

export interface ParsedCommand {
  /** Full command URN (e.g. 'urn:command:chat.CreateMessage:1.0.0') */
  urn: string
  /** Dispatch key linking to a command surface ('create', 'command', etc.) */
  dispatch: string
  /** Command type discriminator for envelope-style endpoints (absent for 'create') */
  commandType?: string
  /** Resolved URI template (e.g. '/api/chat/messages/{id}/command') */
  template: string
  /** Template variable mappings */
  mappings: TemplateMapping[]
  /** Full URL to the JSON schema (already resolved in served apidoc) */
  schemaUrl?: string
}

export interface ParseResult {
  /** Successfully matched commands keyed by derived command name */
  commands: Map<string, ParsedCommand>
  /** URNs from config that were not found in the apidoc */
  missing: string[]
}

// ---------------------------------------------------------------------------
// JSON-LD shape types (structural, not exhaustive)
// ---------------------------------------------------------------------------

interface JsonLdMapping {
  'hydra:variable': string
  'hydra:required'?: boolean
}

interface JsonLdTemplate {
  'hydra:template': string
  'hydra:mapping': JsonLdMapping[]
}

interface JsonLdSurface {
  'svc:dispatch': string
  'svc:template': JsonLdTemplate
}

interface JsonLdCommand {
  '@id': string
  'svc:stableId': string
  'schema:version': string
  'svc:dispatch': string
  'svc:commandType'?: string
  'svc:jsonSchema'?: string
  'svc:surface'?: JsonLdTemplate
}

interface JsonLdCommands {
  'svc:commandSurfaces': JsonLdSurface[]
  'svc:supportedCommand': JsonLdCommand[]
}

interface JsonLdClass {
  'svc:commands'?: JsonLdCommands
}

interface JsonLdApidoc {
  'hydra:supportedClass': JsonLdClass[]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a served apidoc.jsonld and extract routing info for the requested command URNs.
 */
export function parseApidoc(apidoc: unknown, requestedUrns: string[]): ParseResult {
  const doc = apidoc as JsonLdApidoc
  const classes = doc['hydra:supportedClass']
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

function indexSurfaces(surfaces: JsonLdSurface[]): Map<string, JsonLdSurface> {
  const map = new Map<string, JsonLdSurface>()
  for (const s of surfaces) {
    map.set(s['svc:dispatch'], s)
  }
  return map
}

function resolveSharedSurface(
  index: Map<string, JsonLdSurface>,
  dispatch: string,
  urn: string,
): ResolvedSurface {
  const surface = index.get(dispatch)
  assert(surface, `No command surface with dispatch '${dispatch}' for ${urn}`)
  return {
    template: surface['svc:template']['hydra:template'],
    mappings: parseMappings(surface['svc:template']['hydra:mapping']),
  }
}

function resolveCustomSurface(template: JsonLdTemplate): ResolvedSurface {
  return {
    template: template['hydra:template'],
    mappings: parseMappings(template['hydra:mapping']),
  }
}

function parseMappings(raw: JsonLdMapping[]): TemplateMapping[] {
  return raw.map((m) => ({
    variable: m['hydra:variable'],
    required: m['hydra:required'] ?? false,
  }))
}
