import { SchemaRegistry } from '@cqrs-toolkit/schema'
import { Ajv } from 'ajv'
import type { JSONSchema7 } from 'json-schema'
import assert from 'node:assert'
import { HydraDoc } from '../HydraDoc.js'

type JsonLd = Record<string, any>

export interface BuildOptions {
  classes: HydraDoc.ClassDef[]
  /**
   * Domain CURIE prefix names used in classes/mappings.
   * The builder auto-constructs stable `urn:vocab:${name}#` IRIs for committed artifacts.
   * The resolve step maps these to `${docsEntrypoint}/vocab/${name}#` at build/serve time.
   */
  prefixes: string[]
  /** Add extra context terms (rare); merged after built-ins and prefixes. */
  extraContext?: Record<string, any>
  /** On unknown prefix, throw (true) or just warn (false). Default: true. */
  strictPrefixes?: boolean
}

export interface SchemaEntry {
  content: string
  isLatest: boolean
}

export interface BuildResult {
  /** JSON-LD ApiDocumentation object */
  jsonld: JsonLd
  /** Pretty-printed, key-sorted JSON string (stable for commits) */
  content: string
  /** Non-fatal warnings, if any */
  warnings: string[]
  /** Versioned schema files to write. Key = relative path, value = schema entry. */
  schemas: Map<string, SchemaEntry>
}

export function buildHydraApiDocumentation(opts: BuildOptions): BuildResult {
  const { classes } = opts
  const warnings: string[] = []
  const strict = opts.strictPrefixes ?? true

  const isQueryRepresentation = (
    rep: HydraDoc.Representation<HydraDoc.EventsConfig | undefined> | HydraDoc.ViewRepresentation,
  ): rep is HydraDoc.Representation<HydraDoc.EventsConfig | undefined> => {
    return 'itemEvents' in rep || 'aggregateEvents' in rep
  }

  // ---- validation ----
  const repIds = new Set<string>()
  const tplIds = new Set<string>()
  const prefixUse = new Set<string>()
  const semverRe =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
  // light RFC 6838 media type check
  const mtRe = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i

  const addUnique = (set: Set<string>, id: string, kind: string) => {
    if (!id) throw new Error(`Missing ${kind} id`)
    if (set.has(id)) throw new Error(`Duplicate ${kind} id: ${id}`)
    set.add(id)
  }

  const curiePrefix = (term: string): string | null => {
    // CURIE-style "prefix:local" that is not a URL scheme and not a URN scheme
    if (term.startsWith('http://') || term.startsWith('https://') || term.startsWith('urn:'))
      return null
    const i = term.indexOf(':')
    if (i > 0) return term.slice(0, i)
    return null
  }

  const extractVars = (tpl: string): Set<string> => {
    const vars = new Set<string>()
    tpl.replace(/\{([^\}]+)\}/g, (_m, expr: string) => {
      // support "{?a,b,c}" style: split by comma, strip any leading "?" or "&"
      for (const raw of expr.split(',')) {
        const v = raw.replace(/^[\?\&]/, '').trim()
        if (v) vars.add(v)
      }
      return ''
    })
    return vars
  }

  const validateQuerySurface = (
    repId: string,
    label: 'resource' | 'collection',
    surf: HydraDoc.QuerySurface,
  ) => {
    if (!surf) throw new Error(`Rep ${repId} missing ${label} surface`)
    if (!surf.profile) throw new Error(`Rep ${repId} ${label} missing profile`)
    if (!surf.formats?.length)
      throw new Error(`Rep ${repId} ${label} must declare at least one format`)
    for (const mt of surf.formats) {
      if (!mtRe.test(mt)) throw new Error(`Rep ${repId} ${label} has invalid media type: ${mt}`)
    }
    if (!surf.template) throw new Error(`Rep ${repId} ${label} missing template`)
    addUnique(tplIds, surf.template.id, 'template')

    const vars = extractVars(surf.template.template)
    const mapVars = new Set(surf.template.mappings.map((m) => m.variable))
    for (const v of vars) {
      if (!mapVars.has(v)) {
        throw new Error(`Rep ${repId} ${label} template missing mapping for variable '${v}'`)
      }
    }
    for (const m of surf.template.mappings) {
      if (!m.variable) throw new Error(`Rep ${repId} ${label} template mapping missing 'variable'`)
      if (!m.property) throw new Error(`Rep ${repId} ${label} template mapping missing 'property'`)
      const pp = curiePrefix(m.property)
      if (pp) prefixUse.add(pp)
    }
  }

  type AnyCommandSurface = HydraDoc.CommandSurface<any> | HydraDoc.CustomCommandSurface

  const validateCommandSurface = (classIri: string, label: string, surf: AnyCommandSurface) => {
    if (!surf) throw new Error(`Class ${classIri} missing ${label} command surface`)
    if (!surf.method) throw new Error(`Class ${classIri} ${label} command surface missing method`)
    if (surf.method !== 'POST') {
      throw new Error(`Class ${classIri} ${label} command surface must use POST`)
    }
    if (!surf.template)
      throw new Error(`Class ${classIri} ${label} command surface missing template`)
    addUnique(tplIds, surf.template.id, 'template')

    // Command surfaces should not use query expansion in this API.
    if (surf.template.hasQueryExpansion()) {
      throw new Error(
        `Class ${classIri} ${label} command surface must NOT contain query expansion: ${surf.template.template}`,
      )
    }

    const vars = extractVars(surf.template.template)
    const mapVars = new Set(surf.template.mappings.map((m) => m.variable))
    for (const v of vars) {
      if (!mapVars.has(v)) {
        throw new Error(
          `Class ${classIri} ${label} command template missing mapping for variable '${v}'`,
        )
      }
    }
    for (const m of surf.template.mappings) {
      if (!m.variable)
        throw new Error(`Class ${classIri} ${label} command template mapping missing 'variable'`)
      if (!m.property)
        throw new Error(`Class ${classIri} ${label} command template mapping missing 'property'`)
      const pp = curiePrefix(m.property)
      if (pp) prefixUse.add(pp)
    }
  }

  for (const cls of classes) {
    if (!cls.class) throw new Error(`ClassDef missing 'class' IRI`)
    const p = curiePrefix(cls.class)
    if (p) prefixUse.add(p)

    if (!cls.representations?.length) {
      throw new Error(`Class ${cls.class} has no representations`)
    }

    const seenVersions = new Set<string>()
    for (const rep of cls.representations) {
      addUnique(repIds, rep.id, 'representation')

      if (!rep.version || !semverRe.test(rep.version)) {
        throw new Error(`Class ${cls.class} rep ${rep.id} has invalid SemVer: ${rep.version}`)
      }
      if (seenVersions.has(rep.version)) {
        throw new Error(`Class ${cls.class} has duplicate version ${rep.version}`)
      }
      seenVersions.add(rep.version)

      validateQuerySurface(rep.id, 'resource', rep.resource)
      validateQuerySurface(rep.id, 'collection', rep.collection)
    }

    // ---- validate commands ----
    if (cls.commands) {
      const seenDispatch = new Set<string>()
      for (const s of cls.commands.surfaces) {
        if (!s.dispatch) throw new Error(`Class ${cls.class} has command surface missing dispatch`)
        if (seenDispatch.has(s.dispatch)) {
          throw new Error(
            `Class ${cls.class} has duplicate command surface dispatch '${s.dispatch}'`,
          )
        }
        seenDispatch.add(s.dispatch)
        validateCommandSurface(cls.class, `dispatch(${s.dispatch})`, s)
      }

      const seenCmdIds = new Set<string>()
      for (const c of cls.commands.commands) {
        if (!c.id) throw new Error(`Class ${cls.class} has command capability missing id`)
        if (seenCmdIds.has(c.id))
          throw new Error(`Class ${cls.class} has duplicate command id: ${c.id}`)
        seenCmdIds.add(c.id)

        const hasDispatch = !!c.dispatch
        const hasSurface = !!c.surface

        if (hasDispatch && hasSurface) {
          throw new Error(
            `Class ${cls.class} command ${c.id} must define exactly one of dispatch or surface`,
          )
        }
        if (!hasDispatch && !hasSurface) {
          throw new Error(`Class ${cls.class} command ${c.id} must define dispatch or surface`)
        }

        if (c.surface) {
          validateCommandSurface(cls.class, `custom(${c.id})`, c.surface)
        } else {
          // Ensure dispatch resolves to a shared surface
          cls.commands.mustSurface(c.dispatch!)
        }

        const surf = (c.surface ?? cls.commands.mustSurface(c.dispatch!)) as AnyCommandSurface
        if (surf.hrefBase.endsWith('/command') && !c.commandType) {
          throw new Error(
            `Class ${cls.class} command ${c.id} targets '/command' but is missing commandType`,
          )
        }

        if (c.workflow) {
          if (!c.workflow.type) {
            throw new Error(`Class ${cls.class} command ${c.id} workflow is missing type`)
          }
          if (c.workflow.nextStep && !c.workflow.nextStep.id) {
            throw new Error(`Class ${cls.class} command ${c.id} workflow nextStep is missing id`)
          }
        }
      }
    }

    // ---- validate supportedProperties ----
    if (cls.supportedProperties) {
      const seenProperty = new Set<string>()
      for (const sp of cls.supportedProperties) {
        if (!sp.property) {
          throw new Error(`Class ${cls.class} has a supportedProperty missing 'property' IRI`)
        }
        if (seenProperty.has(sp.property)) {
          throw new Error(`Class ${cls.class} has duplicate supportedProperty '${sp.property}'`)
        }
        seenProperty.add(sp.property)

        const pp = curiePrefix(sp.property)
        if (pp) prefixUse.add(pp)

        const propertyKind = sp.links[0].kind
        const seenLinkVersions = new Set<string>()
        for (const link of sp.links) {
          if (link.kind !== propertyKind) {
            throw new Error(
              `Class ${cls.class} supportedProperty ${sp.property} mixes link kinds (${propertyKind} and ${link.kind}); each property must have a single kind`,
            )
          }

          addUnique(repIds, link.id, 'representation')

          if (!link.version || !semverRe.test(link.version)) {
            throw new Error(
              `Class ${cls.class} supportedProperty ${sp.property} link ${link.id} has invalid SemVer: ${link.version}`,
            )
          }
          if (seenLinkVersions.has(link.version)) {
            throw new Error(
              `Class ${cls.class} supportedProperty ${sp.property} has duplicate version ${link.version}`,
            )
          }
          seenLinkVersions.add(link.version)

          const targetSurface = link.kind === 'view' ? link.collection : link.operation
          validateQuerySurface(link.id, 'collection', targetSurface)
        }
      }
    }
  }

  // ---- check prefixes ----
  // Always include built-ins we'll emit in @context
  const builtins: Record<string, string> = {
    hydra: 'http://www.w3.org/ns/hydra/core#',
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    schema: 'https://schema.org/',
  }
  const domainPrefixes: Record<string, string> = Object.fromEntries(
    opts.prefixes.map((p) => [p, `urn:vocab:${p}#`]),
  )
  const context: Record<string, any> = {
    ...builtins,
    ...domainPrefixes,

    // ---- query representations ----
    'svc:representation': { '@container': '@set' },
    'svc:view': { '@container': '@set' },
    'svc:operation': { '@container': '@set' },
    'svc:base': { '@type': '@id' },
    'svc:formats': { '@container': '@set' },
    'svc:profile': { '@type': '@id' },

    // ---- supported properties ----
    'hydra:supportedProperty': { '@container': '@set' },

    // ---- commands ----
    'svc:commands': {},
    'svc:commandSurfaces': { '@container': '@set' },
    'svc:supportedCommand': { '@container': '@set' },
    'svc:dispatch': {},
    'svc:method': {},
    'svc:commandType': {},
    'svc:stableId': {},
    'svc:surface': {},
    'svc:name': {},
    'svc:jsonSchema': { '@type': '@id' },

    // ---- response schemas ----
    'svc:responseSchema': { '@container': '@set' },
    'svc:contentType': {},

    // ---- workflows ----
    'svc:workflow': {},
    'svc:nextStep': {},

    // no @type coercion needed here.
    ...(opts.extraContext ?? {}),
  }

  for (const pref of prefixUse) {
    if (!context[pref]) {
      const msg = `Unknown prefix '${pref}' used in classes/mappings but not provided in BuildOptions.prefixes`
      if (strict) throw new Error(msg)
      warnings.push(msg)
    }
  }

  // ---- build JSON-LD ----
  const jsonld: JsonLd = {
    '@context': context,
    '@id': 'urn:apidoc',
    '@type': 'hydra:ApiDocumentation',
    'hydra:entrypoint': { '@id': 'urn:entrypoint' },
    'hydra:supportedClass': classes.map((cls) => ({
      '@id': cls.class,
      '@type': 'hydra:Class',
      ...(cls.description ? { 'schema:description': cls.description } : {}),
      ...(cls.commands ? { 'svc:commands': renderCommands(cls.commands) } : {}),
      'svc:representation': cls.representations.map((rep) => renderRepresentation(rep)),
      ...(cls.supportedProperties?.length
        ? {
            'hydra:supportedProperty': cls.supportedProperties.map((sp) =>
              renderSupportedProperty(sp),
            ),
          }
        : {}),
    })),
  }

  // ---- collect schemas (with SchemaRegistry normalization) ----
  // All schemas — request bodies, response schemas — share a single registry.
  // A schema is identified only by its $id URN regardless of role.
  const ajv = new Ajv()
  const registry = new SchemaRegistry(ajv, [])

  const schemas = new Map<string, SchemaEntry>()
  const schemaSource = new Map<string, object>()

  const collectSchema = (schema: JSONSchema7, isLatest: boolean, label: string) => {
    const schemaId = schema.$id
    assert(schemaId, `${label} received invalid schema. Missing required $id.`)

    const path = `schemas/${schemaId.replaceAll(':', '/')}.json`
    if (schemas.has(path)) {
      // Same object instance = intentionally shared schema (e.g. core.DeleteAggregate)
      if (schemaSource.get(path) !== schema) {
        warnings.push(`Schema path collision: ${path} (${label})`)
      }
      return
    }

    // Walk + normalize: replaces inline $id sub-schemas with $ref pointers
    registry.register(schema)

    schemaSource.set(path, schema)
    schemas.set(path, {
      content: renderJson(schema),
      isLatest,
    })
  }

  for (const cls of classes) {
    // Command request schemas
    if (cls.commands) {
      for (const s of cls.commands.surfaces) {
        collectResponseSchemas(s.responses, true, `Surface ${s.dispatch}`)
      }
      for (const c of cls.commands.commands) {
        if (c.schema) {
          collectSchema(c.schema, c.isLatest, `Command ${c.id}`)
        }
        collectResponseSchemas(c.responses, c.isLatest, `Command ${c.id}`)
      }
    }

    // Representation response schemas
    for (const rep of cls.representations) {
      for (const surf of [rep.resource, rep.collection]) {
        collectResponseSchemas(surf.responses, true, `Rep ${rep.id}`)
      }
    }

    // Supported-property link response schemas
    if (cls.supportedProperties) {
      for (const sp of cls.supportedProperties) {
        for (const link of sp.links) {
          const surface = link.kind === 'view' ? link.collection : link.operation
          collectResponseSchemas(surface.responses, true, `Link ${link.id}`)
        }
      }
    }
  }

  // ---- collect common schemas (auto-discovered $id sub-schemas) ----
  for (const [id, schema] of registry.getCommonSchemas()) {
    const path = `schemas/${id.replaceAll(':', '/')}.json`
    schemas.set(path, {
      content: renderJson(schema),
      isLatest: true,
    })
  }

  const content = renderJson(jsonld)

  return { jsonld, content, warnings, schemas }

  /** Collect all response schemas with $id into the registry. */
  function collectResponseSchemas(
    responses: readonly HydraDoc.ResponseEntry[] | undefined,
    isLatest: boolean,
    label: string,
  ): void {
    if (!responses) return
    for (const entry of responses) {
      if (typeof entry === 'number') continue
      if (!entry.schema || entry.schema === HydraDoc.NO_BODY) continue
      if (entry.schema.$id) {
        collectSchema(entry.schema, isLatest, `${label} response [${entry.code}]`)
      }
    }
  }

  function renderRepresentation(
    rep: HydraDoc.Representation<HydraDoc.EventsConfig | undefined> | HydraDoc.ViewRepresentation,
  ): JsonLd {
    const base = {
      '@id': rep.id,
      '@type': 'svc:Representation',
      'schema:version': rep.version,
      ...(rep.deprecated ? { 'rdf:type': ['svc:Deprecated'] } : {}),
      'svc:resource': renderSurface(rep.resource),
      'svc:collection': renderSurface(rep.collection),
    }

    if (!isQueryRepresentation(rep)) return base

    return {
      ...base,
      ...(rep.aggregateEvents ? { 'svc:aggregateEvents': renderSurface(rep.aggregateEvents) } : {}),
      ...(rep.itemEvents ? { 'svc:itemEvents': renderSurface(rep.itemEvents) } : {}),
    }
  }

  function renderSupportedProperty(sp: HydraDoc.SupportedProperty): JsonLd {
    const viewNodes: JsonLd[] = []
    const operationNodes: JsonLd[] = []
    for (const link of sp.links) {
      if (link.kind === 'view') viewNodes.push(renderViewNode(link))
      else operationNodes.push(renderOperationLinkNode(link))
    }
    // Validation guarantees all entries share a kind — exactly one of these is non-empty.
    const versions: JsonLd =
      viewNodes.length > 0 ? { 'svc:view': viewNodes } : { 'svc:operation': operationNodes }
    return {
      '@type': 'hydra:SupportedProperty',
      ...(sp.description ? { 'schema:description': sp.description } : {}),
      'hydra:property': {
        '@id': sp.property,
        '@type': 'hydra:TemplatedLink',
        ...versions,
      },
    }
  }

  function renderViewNode(view: HydraDoc.ViewRepresentation): JsonLd {
    return {
      '@id': view.id,
      '@type': 'svc:ViewRepresentation',
      'schema:version': view.version,
      ...(view.deprecated ? { 'rdf:type': ['svc:Deprecated'] } : {}),
      'svc:base': { '@id': view.baseId },
      'svc:collection': renderSurface(view.collection),
    }
  }

  function renderOperationLinkNode(link: HydraDoc.OperationLink): JsonLd {
    return {
      '@id': link.id,
      '@type': 'svc:OperationLink',
      'schema:version': link.version,
      ...(link.deprecated ? { 'rdf:type': ['svc:Deprecated'] } : {}),
      'svc:surface': renderSurface(link.operation),
    }
  }

  function renderSurface(surf: HydraDoc.QuerySurface): JsonLd {
    const hydraResponses = deriveHydraResponseSchemas(surf.responses, surf.responseSchemaUrn)
    return {
      '@type': 'svc:Surface',
      ...(surf.description ? { 'schema:description': surf.description } : {}),
      'svc:formats': surf.formats,
      'svc:profile': { '@id': surf.profile },
      'svc:template': iriTemplateNode(surf.template),
      ...(hydraResponses.length > 0
        ? {
            'svc:responseSchema': hydraResponses.map((rs) => ({
              '@type': 'svc:ContentTypeSchema',
              'svc:contentType': rs.contentType,
              'svc:jsonSchema': rs.schemaId,
            })),
          }
        : {}),
    }
  }

  function renderCommands(cmds: HydraDoc.CommandsDef<any>): JsonLd {
    return {
      '@type': 'svc:Commands',
      'svc:commandSurfaces': cmds.surfaces.map((s) => ({
        '@type': 'svc:CommandSurface',
        'svc:dispatch': s.dispatch,
        'svc:method': s.method,
        'svc:template': iriTemplateNode(s.template),
      })),
      'svc:supportedCommand': cmds.commands.map((c) => {
        const hydraResponses = deriveHydraResponseSchemas(c.responses, c.responseSchemaUrn)
        return {
          '@id': c.id,
          '@type': 'svc:CommandCapability',
          ...(c.description ? { 'schema:description': c.description } : {}),
          'svc:stableId': c.stableId,
          'schema:version': c.version,
          ...(c.deprecated ? { 'schema:deprecated': true } : {}),
          ...(c.dispatch ? { 'svc:dispatch': c.dispatch } : {}),
          ...(c.commandType ? { 'svc:commandType': c.commandType } : {}),
          ...(c.schema ? { 'svc:jsonSchema': c.schema.$id } : {}),
          ...(c.surface
            ? {
                'svc:surface': {
                  '@type': 'svc:CommandSurface',
                  ...(c.surface.name ? { 'svc:name': c.surface.name } : {}),
                  'svc:method': c.surface.method,
                  'svc:template': iriTemplateNode(c.surface.template),
                },
              }
            : {}),
          ...(hydraResponses.length > 0
            ? {
                'svc:responseSchema': hydraResponses.map((rs) => ({
                  '@type': 'svc:ContentTypeSchema',
                  'svc:contentType': rs.contentType,
                  'svc:jsonSchema': rs.schemaId,
                })),
              }
            : {}),
          ...(c.workflow ? { 'svc:workflow': renderWorkflow(c.workflow) } : {}),
        }
      }),
    }
  }
}

function renderWorkflow(w: HydraDoc.Workflow): JsonLd {
  return {
    '@type': w.type,
    ...(w.nextStep
      ? {
          'svc:nextStep': {
            '@id': w.nextStep.id,
            '@type': 'svc:ExternalEndpoint',
            ...(w.nextStep.supportedOperation?.length
              ? {
                  'hydra:supportedOperation': w.nextStep.supportedOperation.map((op) => ({
                    '@type': 'hydra:Operation',
                    'hydra:method': op.method,
                    ...(op.expects ? { 'hydra:expects': op.expects } : {}),
                  })),
                }
              : {}),
          },
        }
      : {}),
  }
}

const DEFAULT_CONTENT_TYPE = 'application/json'

/**
 * Derive svc:responseSchema entries from the responses array.
 * Filters 2xx entries, groups by contentType, deduplicates by $id.
 * Different $ids for the same contentType → oneOf union under responseSchemaUrn.
 */
function deriveHydraResponseSchemas(
  responses: readonly HydraDoc.ResponseEntry[] | undefined,
  responseSchemaUrn: string | undefined,
): { contentType: string; schemaId: string }[] {
  if (!responses) return []

  // Collect 2xx entries with schemas
  const byContentType = new Map<string, Set<string>>()
  for (const entry of responses) {
    if (typeof entry === 'number') continue
    if (entry.code < 200 || entry.code >= 300) continue
    if (!entry.schema || entry.schema === HydraDoc.NO_BODY) continue
    const schemaId = entry.schema.$id
    if (!schemaId) continue

    const ct = entry.contentType ?? DEFAULT_CONTENT_TYPE
    let ids = byContentType.get(ct)
    if (!ids) {
      ids = new Set()
      byContentType.set(ct, ids)
    }
    ids.add(schemaId)
  }

  const result: { contentType: string; schemaId: string }[] = []
  for (const [ct, ids] of byContentType) {
    if (ids.size === 1) {
      const [schemaId] = ids
      assert(schemaId, 'unreachable: set is non-empty')
      result.push({ contentType: ct, schemaId })
    } else {
      // Multiple different $ids for the same contentType → oneOf union
      assert(
        responseSchemaUrn,
        `Multiple 2xx response schemas for contentType '${ct}' require responseSchemaUrn to publish the oneOf union`,
      )
      result.push({ contentType: ct, schemaId: responseSchemaUrn })
    }
  }
  return result
}

function iriTemplateNode(t: HydraDoc.IriTemplate) {
  return {
    '@id': t.id,
    '@type': 'hydra:IriTemplate',
    'hydra:template': t.template,
    'hydra:mapping': t.mappings.map((m) => ({
      '@type': 'hydra:IriTemplateMapping',
      'hydra:variable': m.variable,
      'hydra:property': m.property,
      ...(m.required ? { 'hydra:required': true } : {}),
      ...(m.description ? { 'schema:description': m.description } : {}),
    })),
  }
}

/** Recursively sort object keys (preserves arrays). For deterministic JSON output. */
export function stableOrder(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stableOrder)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v as Record<string, unknown>).sort())
      out[k] = stableOrder((v as Record<string, unknown>)[k])
    return out
  }
  return v
}

function renderJson(value: unknown): string {
  return JSON.stringify(stableOrder(value), null, 2) + '\n'
}
