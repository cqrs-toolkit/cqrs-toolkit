/**
 * Types describing the rendered Hydra API Documentation JSON-LD document.
 *
 * Each interface is named after its `@type` value, following Hydra Core vocabulary convention.
 * These mirror the output of {@link buildHydraApiDocumentation}.
 */

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace HydraApiDocumentation {
  // ---------------------------------------------------------------------------
  // Root document
  // ---------------------------------------------------------------------------

  export interface Document {
    '@context': Record<string, string | Record<string, string>>
    '@id': string
    '@type': 'hydra:ApiDocumentation'
    'hydra:entrypoint': { '@id': string }
    'hydra:supportedClass': Class[]
  }

  // ---------------------------------------------------------------------------
  // Classes
  // ---------------------------------------------------------------------------

  export interface Class {
    '@id': string
    '@type': 'hydra:Class'
    'schema:description'?: string
    'svc:commands'?: Commands
    'svc:representation': Representation[]
    'hydra:supportedProperty'?: SupportedProperty[]
  }

  // ---------------------------------------------------------------------------
  // Supported properties (templated links)
  // ---------------------------------------------------------------------------

  export interface SupportedProperty {
    '@type': 'hydra:SupportedProperty'
    'schema:description'?: string
    'hydra:property': TemplatedLink
  }

  export type TemplatedLink = TemplatedViewLink | TemplatedOperationLink

  /** TemplatedLink whose target is a collection-style scoped sub-resource. */
  export interface TemplatedViewLink {
    '@id': string
    '@type': 'hydra:TemplatedLink'
    /** Versioned view nodes — non-empty tuple, mirroring `Class['svc:representation']`. */
    'svc:view': readonly [ViewRepresentationNode, ...ViewRepresentationNode[]]
  }

  /** TemplatedLink whose target is a single-resource templated operation. */
  export interface TemplatedOperationLink {
    '@id': string
    '@type': 'hydra:TemplatedLink'
    /** Versioned operation link nodes — non-empty tuple. */
    'svc:operation': readonly [OperationLinkNode, ...OperationLinkNode[]]
  }

  export interface ViewRepresentationNode {
    '@id': string
    '@type': 'svc:ViewRepresentation'
    'schema:version': string
    /** e.g. `['svc:Deprecated']`. */
    'rdf:type'?: string[]
    /** `@id` of the base {@link Representation} (i.e. {@link Representation}'s `@id`). */
    'svc:base': { '@id': string }
    'svc:collection': QuerySurface
  }

  export interface OperationLinkNode {
    '@id': string
    '@type': 'svc:OperationLink'
    'schema:version': string
    /** e.g. `['svc:Deprecated']`. */
    'rdf:type'?: string[]
    /** Single templated operation surface (no required query expansion). */
    'svc:surface': QuerySurface
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  export interface Commands {
    '@type': 'svc:Commands'
    'svc:commandSurfaces': CommandSurface[]
    'svc:supportedCommand': CommandCapability[]
  }

  export interface CommandSurface {
    '@type': 'svc:CommandSurface'
    'svc:dispatch'?: string
    'svc:name'?: string
    'svc:method': string
    'svc:template': IriTemplate
  }

  export interface CommandCapability {
    '@id': string
    '@type': 'svc:CommandCapability'
    'schema:description'?: string
    'svc:stableId': string
    'schema:version': string
    'schema:deprecated'?: true
    'svc:dispatch'?: string
    'svc:commandType'?: string
    'svc:jsonSchema'?: string
    'svc:surface'?: CommandSurface
    'svc:responseSchema'?: ContentTypeSchema[]
    'svc:workflow'?: Workflow
  }

  // ---------------------------------------------------------------------------
  // Representations & query surfaces
  // ---------------------------------------------------------------------------

  export interface Representation {
    '@id': string
    '@type': 'svc:Representation'
    'schema:version': string
    'rdf:type'?: string[]
    'svc:resource': QuerySurface
    'svc:collection': QuerySurface
    'svc:itemEvents'?: QuerySurface
    'svc:aggregateEvents'?: QuerySurface
  }

  export interface QuerySurface {
    '@type': 'svc:Surface'
    'schema:description'?: string
    'svc:formats': string[]
    'svc:profile': { '@id': string }
    'svc:template': IriTemplate
    'svc:responseSchema'?: ContentTypeSchema[]
  }

  export interface ContentTypeSchema {
    '@type': 'svc:ContentTypeSchema'
    'svc:contentType': string
    'svc:jsonSchema': string
  }

  // ---------------------------------------------------------------------------
  // IRI templates
  // ---------------------------------------------------------------------------

  export interface IriTemplate {
    '@id': string
    '@type': 'hydra:IriTemplate'
    'hydra:template': string
    'hydra:mapping': IriTemplateMapping[]
  }

  export interface IriTemplateMapping {
    '@type': 'hydra:IriTemplateMapping'
    'hydra:variable': string
    'hydra:property': string
    'hydra:required'?: true
    'schema:description'?: string
  }

  // ---------------------------------------------------------------------------
  // Workflows & external endpoints
  // ---------------------------------------------------------------------------

  export interface Workflow {
    '@type': string
    'svc:nextStep'?: ExternalEndpoint
  }

  export interface ExternalEndpoint {
    '@id': string
    '@type': 'svc:ExternalEndpoint'
    'hydra:supportedOperation'?: Operation[]
  }

  export interface Operation {
    '@type': 'hydra:Operation'
    'hydra:method': string
    'hydra:expects'?: string
  }
}
