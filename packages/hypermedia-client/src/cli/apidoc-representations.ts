/**
 * Parse representation surfaces from a served apidoc.jsonld.
 */

import assert from 'node:assert'
import type {
  RepresentationManifest,
  RepresentationSurfaces,
  SurfaceEndpoint,
} from '../runtime/types.js'

// ---------------------------------------------------------------------------
// JSON-LD shape types
// ---------------------------------------------------------------------------

interface JsonLdSurface {
  'svc:template': {
    'hydra:template': string
  }
}

interface JsonLdRepresentation {
  '@id': string
  'schema:version': string
  'svc:collection'?: JsonLdSurface
  'svc:resource'?: JsonLdSurface
  'svc:itemEvents'?: JsonLdSurface
  'svc:aggregateEvents'?: JsonLdSurface
}

interface JsonLdClass {
  '@id': string
  'svc:representation'?: JsonLdRepresentation[]
}

interface JsonLdApidoc {
  'hydra:supportedClass': JsonLdClass[]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RepresentationParseResult {
  /** Parsed representations keyed by class @id */
  representations: RepresentationManifest
  /** Requested @id fragments that were not found */
  missing: string[]
}

/**
 * Parse representation surfaces from the apidoc for the requested @id fragments.
 * Returns the representations keyed by the parent class @id.
 */
export function parseRepresentations(
  apidoc: unknown,
  requestedIds: string[],
): RepresentationParseResult {
  const doc = apidoc as JsonLdApidoc
  const classes = doc['hydra:supportedClass']
  assert(Array.isArray(classes), 'apidoc must have hydra:supportedClass array')

  const requested = new Set(requestedIds)
  const representations: RepresentationManifest = {}
  const found = new Set<string>()

  for (const cls of classes) {
    const reps = cls['svc:representation']
    if (!Array.isArray(reps)) continue

    for (const rep of reps) {
      if (!requested.has(rep['@id'])) continue
      found.add(rep['@id'])

      const surfaces = extractSurfaces(rep, cls['@id'])
      representations[cls['@id']] = surfaces
    }
  }

  const missing = requestedIds.filter((id) => !found.has(id))
  return { representations, missing }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function extractSurfaces(rep: JsonLdRepresentation, className: string): RepresentationSurfaces {
  const collection = rep['svc:collection']
  const resource = rep['svc:resource']
  const itemEvents = rep['svc:itemEvents']
  const aggregateEvents = rep['svc:aggregateEvents']

  assert(collection, `Representation ${rep['@id']} (${className}) missing svc:collection`)
  assert(resource, `Representation ${rep['@id']} (${className}) missing svc:resource`)
  assert(itemEvents, `Representation ${rep['@id']} (${className}) missing svc:itemEvents`)
  assert(aggregateEvents, `Representation ${rep['@id']} (${className}) missing svc:aggregateEvents`)

  return {
    version: rep['schema:version'],
    collection: extractEndpoint(collection),
    resource: extractEndpoint(resource),
    itemEvents: extractEndpoint(itemEvents),
    aggregateEvents: extractEndpoint(aggregateEvents),
  }
}

function extractEndpoint(surface: JsonLdSurface): SurfaceEndpoint {
  const template = surface['svc:template']['hydra:template']
  // Derive href by stripping query expansion (everything from '{?' onwards)
  const queryExpansionIndex = template.indexOf('{?')
  const href = queryExpansionIndex !== -1 ? template.slice(0, queryExpansionIndex) : undefined
  const endpoint: SurfaceEndpoint = { template }
  if (href) {
    endpoint.href = href
  }
  return endpoint
}
