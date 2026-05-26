/**
 * Parse representation surfaces from a served apidoc.jsonld.
 */

import type { HydraApiDocumentation } from '@cqrs-toolkit/hypermedia'
import assert from 'node:assert'
import type {
  RepresentationManifest,
  RepresentationSurfaces,
  SurfaceEndpoint,
} from '../runtime/types.js'

export type SurfaceKey = 'collection' | 'resource' | 'itemEvents' | 'aggregateEvents'

export interface ResponseSchemaRef {
  /** Media type (e.g. 'application/json') */
  contentType: string
  /** Full URL to the JSON schema */
  schemaUrl: string
}

/** Per-surface response schemas extracted from a representation's QuerySurfaces. */
export type RepresentationResponseSchemas = {
  [K in SurfaceKey]?: ResponseSchemaRef[]
}

export interface RepresentationParseResult {
  /** Parsed representations keyed by class @id */
  representations: RepresentationManifest
  /** Response schemas keyed by class @id, mirroring `representations` */
  responseSchemas: Record<string, RepresentationResponseSchemas>
  /** Requested @id fragments that were not found */
  missing: string[]
}

/**
 * Parse representation surfaces from the apidoc for the requested @id fragments.
 * Returns the representations keyed by the parent class @id.
 */
export function parseRepresentations(
  apidoc: HydraApiDocumentation.Document,
  requestedIds: string[],
): RepresentationParseResult {
  const classes = apidoc['hydra:supportedClass']
  assert(Array.isArray(classes), 'apidoc must have hydra:supportedClass array')

  const requested = new Set(requestedIds)
  const representations: RepresentationManifest = {}
  const responseSchemas: Record<string, RepresentationResponseSchemas> = {}
  const found = new Set<string>()

  for (const cls of classes) {
    const reps = cls['svc:representation']
    if (!Array.isArray(reps)) continue

    for (const rep of reps) {
      if (!requested.has(rep['@id'])) continue
      found.add(rep['@id'])
      representations[cls['@id']] = extractSurfaces(rep, cls['@id'])
      responseSchemas[cls['@id']] = extractResponseSchemas(rep)
    }
  }

  const missing = requestedIds.filter((id) => !found.has(id))
  return { representations, responseSchemas, missing }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function extractSurfaces(
  rep: HydraApiDocumentation.Representation,
  className: string,
): RepresentationSurfaces {
  const collection = rep['svc:collection']
  const resource = rep['svc:resource']
  const itemEvents = rep['svc:itemEvents']
  const aggregateEvents = rep['svc:aggregateEvents']

  assert(collection, `Representation ${rep['@id']} (${className}) missing svc:collection`)
  assert(resource, `Representation ${rep['@id']} (${className}) missing svc:resource`)
  assert(itemEvents, `Representation ${rep['@id']} (${className}) missing svc:itemEvents`)
  assert(aggregateEvents, `Representation ${rep['@id']} (${className}) missing svc:aggregateEvents`)

  return {
    urn: rep['@id'],
    version: rep['schema:version'],
    collection: extractEndpoint(collection),
    resource: extractEndpoint(resource),
    itemEvents: extractEndpoint(itemEvents),
    aggregateEvents: extractEndpoint(aggregateEvents),
  }
}

function extractResponseSchemas(
  rep: HydraApiDocumentation.Representation,
): RepresentationResponseSchemas {
  const result: RepresentationResponseSchemas = {}
  const surfaces: { key: SurfaceKey; surface: HydraApiDocumentation.QuerySurface | undefined }[] = [
    { key: 'collection', surface: rep['svc:collection'] },
    { key: 'resource', surface: rep['svc:resource'] },
    { key: 'itemEvents', surface: rep['svc:itemEvents'] },
    { key: 'aggregateEvents', surface: rep['svc:aggregateEvents'] },
  ]
  for (const { key, surface } of surfaces) {
    if (!surface) continue
    const schemas = surface['svc:responseSchema']
    if (schemas && schemas.length > 0) {
      result[key] = schemas.map((s) => ({
        contentType: s['svc:contentType'],
        schemaUrl: s['svc:jsonSchema'],
      }))
    }
  }
  return result
}

function extractEndpoint(surface: HydraApiDocumentation.QuerySurface): SurfaceEndpoint {
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
