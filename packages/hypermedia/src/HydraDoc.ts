import type { JSONSchema7 } from 'json-schema'
import assert from 'node:assert'
import {
  assertNoQueryExpansionInTemplate,
  buildTemplateIri,
  deriveQueryVarsFromMappings,
  semverDesc,
  uriTemplatePathToColon,
} from './utils.js'

export namespace HydraDoc {
  // ---------------------------------------------------------------------------
  // Response documentation types
  // ---------------------------------------------------------------------------

  /** Sentinel for responses with explicitly no body. */
  export const NO_BODY = Symbol('NO_BODY')

  /** Object form of a response entry. */
  export interface ResponseDef {
    code: number
    /** Defaults to 'application/json' when omitted. */
    contentType?: string
    /** Response body schema. Use NO_BODY for explicitly empty responses. */
    schema?: JSONSchema7 | typeof NO_BODY
    description?: string
  }

  /** A bare number is shorthand for { code: N, contentType: 'application/json' }. */
  export type ResponseEntry = number | ResponseDef

  /** Fully resolved response — schema and contentType required. Used in top-level registries. */
  export interface ResolvedResponseDef {
    code: number
    contentType: string
    schema: JSONSchema7
    description?: string
  }

  // ---------------------------------------------------------------------------
  // IRI template types
  // ---------------------------------------------------------------------------

  export interface IriTemplateMapping {
    variable: string
    property: string
    required?: boolean
    /**
     * Per-mapping schema override for OpenAPI parameter generation.
     * Takes precedence over the property registry default in OpenApiDocumentation.
     * Use for properties whose schema varies by context (e.g. svc:include with per-representation enum values).
     */
    schema?: JSONSchema7
    /** Per-mapping description override. Takes precedence over the dictionary default. */
    description?: string
  }

  export interface ExternalEndpointOperation {
    /** HTTP method */
    method: string
    /** Expected request content type (e.g. 'multipart/form-data') */
    expects?: string
  }

  export interface ExternalEndpoint {
    /** JSON-LD @id for this endpoint (e.g. 'svc:S3FormPost') */
    id: string
    /** Operations supported by this external endpoint */
    supportedOperation?: readonly ExternalEndpointOperation[]
  }

  export interface Workflow {
    /** Workflow type URI identifying the convention (e.g. 'svc:PresignedPostUpload') */
    type: string
    /** External endpoint definition for the next step */
    nextStep?: ExternalEndpoint
  }

  export interface PlainIriTemplate {
    /** JSON-LD @id (use a fragment for doc-local anchors) */
    id: string
    /**
     * RFC6570 template. For collections this is typically a query template:
     *   "/api/foo{?q,limit,cursor}"
     * For resources it MAY be a path template:
     *   "/api/foo/{id}"
     */
    template: `/${string}`
    mappings: readonly IriTemplateMapping[]
    /** Optional RFC6570 variable representation hint, e.g. "ExplicitRepresentation" for arrays */
    variableRepresentation?: 'BasicRepresentation' | 'ExplicitRepresentation'
  }

  /** The built-in shared command surfaces every aggregate may support. */
  export type StandardCommandDispatch = 'create' | 'command'

  /**
   * Dispatch key for shared command surfaces.
   * Extend by providing `Ext`, e.g. CommandDispatch<'associate' | 'bulk'>.
   */
  export type CommandDispatch<Ext extends string> = StandardCommandDispatch | Ext

  /** OpenAPI operation metadata shared by all surfaces (command and query). */
  export interface OperationDocumentation {
    /** OpenAPI operationId. Required for OpenAPI generation. */
    operationId?: string
    /** Human-readable description of this operation. */
    description?: string
    /** Response documentation for this operation. */
    responses?: readonly ResponseEntry[]
    /** URN for the oneOf union schema when 2xx responses have different schemas per contentType. */
    responseSchemaUrn?: string
  }

  function getOperationDocumentation<T extends OperationDocumentation>(
    doc: T,
  ): OperationDocumentation {
    return {
      operationId: doc.operationId,
      description: doc.description,
      responses: doc.responses,
      responseSchemaUrn: doc.responseSchemaUrn,
    }
  }

  /**
   * Shared shape for any command surface.
   *
   * - Commands are invoked via HTTP (currently always POST).
   * - Command surfaces MUST NOT use RFC6570 query expansion in this system.
   * - Path variables (e.g. "{id}") are documented via template mappings.
   */
  export interface PlainCommandSurfaceBase extends OperationDocumentation {
    /** HTTP method for invoking this command surface. */
    method: 'POST'

    /**
     * URI template describing how to invoke this surface.
     *
     * Examples:
     * - "/api/chat/rooms"                 (create)
     * - "/api/chat/rooms/{id}/command"    (envelope commands)
     * - "/api/chat/rooms/association"     (custom endpoint)
     */
    template: PlainIriTemplate
  }

  /**
   * A **shared** command surface registered on the class and selected by `dispatch`.
   *
   * This is the normal case and exists to avoid repeating endpoint templates for
   * many commands that share the same HTTP route shape.
   */
  export interface PlainCommonCommandSurface<Ext extends string> extends PlainCommandSurfaceBase {
    /**
     * Logical surface key used to reference this surface within the class.
     *
     * Examples:
     * - 'create'  → POST /api/<svc>/<aggregate>
     * - 'command' → POST /api/<svc>/<aggregate>/{id}/command
     *
     * Custom values are allowed if you introduce additional shared entrypoints.
     *
     * NOTE: This is an internal selection key, not an HTTP routing token.
     */
    dispatch: CommandDispatch<Ext>
  }

  /**
   * A **custom** command surface used only by a single capability.
   *
   * This surface is *not* part of the class's shared surface table and is not
   * referenced by dispatch. It exists for rare commands that use a bespoke route.
   *
   * You may optionally provide a human-friendly label for debugging/diffs.
   */
  export interface PlainCustomCommandSurface extends PlainCommandSurfaceBase {
    /** Optional label for humans/logging; not used for resolution. */
    name?: string
  }

  export type PlainCommandSurface<Ext extends string> =
    | PlainCommonCommandSurface<Ext>
    | PlainCustomCommandSurface

  export interface BaseCommandCapability {
    /**
     * Stable, versioned identifier for this command capability.
     *
     * Used by clients for compatibility checks:
     * "Am I programmed to send this command id/version, and is it still documented?"
     *
     * Example: 'urn:command:chat.RenameRoom:1.0.0'
     */
    id: string

    /**
     * Marks this command version as deprecated.
     *
     * Deprecated commands are still documented and accepted for a deprecation window,
     * but clients should warn and migrate to a newer command id/version.
     */
    deprecated?: boolean

    /**
     * Optional discriminator for envelope-style command endpoints.
     *
     * Applies only when the effective surface is the shared "/command" endpoint:
     *   POST .../{id}/command
     *   body: { type: <commandType>, data: ... }
     *
     * Not used for create-style endpoints or custom endpoints that do not use
     * the envelope convention.
     */
    commandType?: string

    /**
     * Version-independent identifier that groups multiple versions of the same
     * logical command together. Used by the command surface to determine which
     * version is "latest" and to route old payloads through adapters.
     */
    stableId: string

    /** Semantic version of this command capability (e.g. '1.0.0'). */
    version: string

    /** JSON Schema describing the request body for this command version. */
    schema?: JSONSchema7

    /** Response documentation for this command. Overrides dispatch surface defaults when provided. */
    responses?: readonly ResponseEntry[]
    /** URN for the oneOf union schema when 2xx responses have different schemas per contentType. */
    responseSchemaUrn?: string

    /** Workflow annotation declaring chained operation semantics. */
    workflow?: Workflow

    /** Human-readable description of what this command does. */
    description?: string

    /** Runtime adapter that transforms old-version data to the current shape. */
    adapt?: (oldData: unknown) => unknown

    /** Runtime hydrator that converts validated data into the domain command shape. */
    hydrate?: (validated: unknown) => unknown
  }

  export interface PlainCommonCommandCapability<Ext extends string> extends BaseCommandCapability {
    /**
     * Selects one of the class's shared command surfaces by dispatch key.
     *
     * This is the normal case: most commands share a small set of shared surfaces
     * (e.g. 'create' and 'command') to avoid repeating endpoint templates.
     */
    dispatch: CommandDispatch<Ext>

    /** Disallow custom surface on common capabilities. */
    surface?: never
  }

  export interface PlainCustomCommandCapability extends BaseCommandCapability {
    /**
     * Explicit surface for rare commands that use a bespoke endpoint.
     *
     * When present, this surface is the command's invocation contract.
     * There is no fallback to a shared dispatch surface.
     */
    surface: PlainCustomCommandSurface

    /** Disallow dispatch on custom capabilities. */
    dispatch?: never
  }

  export type PlainCommandCapability<Ext extends string> =
    | PlainCommonCommandCapability<Ext>
    | PlainCustomCommandCapability

  export interface PlainCommandsDef<Ext extends string> {
    /**
     * Shared mutation command surfaces keyed by dispatch.
     *
     * By convention, shared command surface template ids use the form:
     *
     *   `${idStem}-mut-<name>`
     *
     * where:
     * - `mut-*` denotes a **mutation entrypoint** (CQRS write surface)
     * - `<name>` matches the logical dispatch key (`create`, `command`, or a custom extension)
     *
     * The default surfaces produced by `standardCommandSurfaces()` follow this convention:
     * - `mut-create`  → POST /collection
     * - `mut-command` → POST /collection/{id}/command
     *
     * If you introduce additional **re-used** shared mutation surfaces (i.e. extending
     * `standardCommandSurfaces` with new dispatch keys), you should follow the same
     * `mut-<dispatch>` naming pattern to keep documentation consistent and readable.
     *
     * Note: these ids are documentation identifiers only; they are not HTTP routes,
     * capability ids, or client-facing API tokens.
     */
    surfaces: readonly PlainCommonCommandSurface<Ext>[]
    /** Supported versioned commands for this aggregate class. */
    commands: readonly PlainCommandCapability<Ext>[]
  }

  export interface PlainQuerySurface extends OperationDocumentation {
    /**
     * Media types the server can PRODUCE for this surface.
     * Example: ['application/json','application/hal+json']
     */
    formats: readonly string[]
    /**
     * Profile identifier (IRI/URN) for this surface's wire contract.
     * Example: 'urn:profile:storage.FileObject:1.0.0'
     */
    profile: string
    /**
     * IRI template describing how to fetch this surface.
     * Format: RFC6570 query expansion with the supported variables.
     * Example: /api/storage/file-objects/{id}
     * - For a collection, this is typically the SEARCH template (query params).
     * - For a resource, include to document all id parameters.
     */
    template: PlainIriTemplate
  }

  export interface ResourceSurface extends PlainQuerySurface {
    /**
     * Non-templated, canonical IRI for this surface.
     * Derived if omitted.
     * - For a collection: "/api/foo"
     * - For a resource-by-id you must still include any path tokens (e.g. "/api/foo/{id}"),
     *   but do NOT include query parameters here.
     */
    href?: `/${string}`
  }

  export interface CollectionSurface extends PlainQuerySurface {
    /**
     * Non-templated, canonical IRI for this surface.
     * Derived if omitted.
     * - For a collection: "/api/foo"
     * - For a resource-by-id you must still include any path tokens (e.g. "/api/foo/{id}"),
     *   but do NOT include query parameters here.
     */
    href: `/${string}`
  }

  export interface EventsResourceConfig {
    /** Optional template node @id (fragment). Default is derived. */
    id?: string
    /** REQUIRED: profile IRI/URN for the surface */
    profile: string
  }

  interface BaseEventsConfig {
    resourceSegment: string
    baseHref: `/${string}`
  }

  export type EventsWithItem = BaseEventsConfig & {
    item: EventsResourceConfig
    aggregate?: EventsResourceConfig
  }
  export type EventsWithAgg = BaseEventsConfig & {
    item?: EventsResourceConfig
    aggregate: EventsResourceConfig
  }
  export type EventsConfig = EventsWithItem | EventsWithAgg

  export interface PlainRepresentation<E extends EventsConfig | undefined = undefined> {
    /**
     *  JSON-LD @id for this representation node
     *  Format: #<prefix>-<local>-v<semver_underscored>
     *  Example: #storage-fileobject-v1_0_0
     */
    id: string
    /** Semantic version of this representation (SemVer), e.g., "1.0.0". */
    version: string
    /** Mark this representation as deprecated (still documented, slated for removal). */
    deprecated?: boolean

    /**
     * Single-resource surface of this class (GET by id).
     * profile format: urn:profile:<service.Domain>:<semver>
     */
    resource: ResourceSurface
    /**
     * Collection/search surface for this class.
     * profile format: urn:profile:<service.Domain>Collection:<semver>
     */
    collection: CollectionSurface

    /** optional events surfaces */
    events?: E
  }

  export interface PlainViewRepresentation {
    /**
     *  JSON-LD @id for this view representation node
     *  Format: #<prefix>-<local>-v<semver_underscored>
     *  Example: #pms-requirement-file-objects-v1_0_0
     */
    id: string
    /** Semantic version of this view representation (SemVer), e.g., "1.0.0". */
    version: string
    /** Mark this view representation as deprecated (still documented, slated for removal). */
    deprecated?: boolean

    /**
     * Canonical representation being viewed.
     * - Items are still this class, with canonical @id/_links.self
     * - We reuse its resource surface to avoid copy/paste/drift.
     */
    base: Representation<any>

    /**
     * Collection/search surface for this view.
     * This is the only "new" surface the view introduces.
     */
    collection: CollectionSurface
  }

  export interface ClassDef<Ext extends string = never> {
    /** class IRI, e.g. 'storage:FileObject' */
    class: string
    /** Human-readable description of this resource class. */
    description?: string
    /** CQRS command capabilities and surfaces (NOT coupled to read representation versions) */
    commands?: CommandsDef<Ext>
    representations: (Representation<HydraDoc.EventsConfig | undefined> | ViewRepresentation)[]
  }

  // ---------- Public API classes (validation + helpers) ----------
  export class IriTemplate {
    readonly template: `/${string}`

    constructor(
      readonly id: string,
      template: `/${string}`,
      readonly mappings: readonly IriTemplateMapping[],
      readonly variableRepresentation?: 'BasicRepresentation' | 'ExplicitRepresentation',
    ) {
      assert(id, 'IriTemplate.id is required')
      assert(template, 'IriTemplate.template is required')

      // Migration guard: no more duplication of "{?...}" at call sites.
      assertNoQueryExpansionInTemplate(id, template)

      // derive query expansion from mappings order (excluding path vars).
      const queryVars = deriveQueryVarsFromMappings(template, mappings)
      this.template = queryVars.length === 0 ? template : buildTemplateIri(template, queryVars)
    }
    baseHref(): `/${string}` {
      // Strip RFC6570 {?...} query expansion suffix
      return this.template.replace(/\{\?[^}]*\}$/, '') as `/${string}`
    }
    hasQueryExpansion(): boolean {
      return /\{\?[^}]*\}/.test(this.template)
    }
  }

  // "mut-*" ids denote mutation entrypoints (CQRS write surfaces)
  export function standardCommandSurfaces<Ext extends string = never>(opts: {
    idStem: string
    collectionHref: `/${string}`
    idProperty: string
  }): PlainCommonCommandSurface<Ext>[] {
    return [standardCreateCommandSurface(opts), standardCommandSurface(opts)]
  }

  export interface StandardCreateCommandSurfaceOpts extends OperationDocumentation {
    idStem: string
    collectionHref: `/${string}`
  }

  export function standardCreateCommandSurface<Ext extends string = never>(
    opts: StandardCreateCommandSurfaceOpts,
  ): PlainCommonCommandSurface<Ext> {
    const { idStem, collectionHref } = opts
    return {
      dispatch: 'create',
      method: 'POST',
      template: {
        id: `${idStem}-mut-create`,
        template: collectionHref,
        mappings: [],
      },
      ...getOperationDocumentation(opts),
    }
  }

  export interface StandardCommandSurfaceOpts extends OperationDocumentation {
    idStem: string
    collectionHref: `/${string}`
    idProperty: string
  }

  export function standardCommandSurface<Ext extends string = never>(
    opts: StandardCommandSurfaceOpts,
  ): PlainCommonCommandSurface<Ext> {
    const { idStem, collectionHref, idProperty } = opts
    return {
      dispatch: 'command',
      method: 'POST',
      template: {
        id: `${idStem}-mut-command`,
        template: `${collectionHref}/{id}/command`,
        mappings: [{ variable: 'id', property: idProperty, required: true }],
      },
      ...getOperationDocumentation(opts),
    }
  }

  class BaseCommandSurface {
    readonly method: 'POST'
    readonly template: IriTemplate

    constructor(plain: PlainCommandSurfaceBase) {
      const { method, template } = plain
      assert(method, 'CommandSurface.method is required')
      assert(method === 'POST', 'CommandSurface.method must be POST')
      assert(template, 'CommandSurface.template is required')

      this.method = method
      this.template = new IriTemplate(
        template.id,
        template.template,
        template.mappings,
        template.variableRepresentation,
      )

      assert(
        !this.template.hasQueryExpansion(),
        `Command surface template must NOT contain query expansion: ${this.template.template}`,
      )
    }

    /** Non-templated canonical href (command surfaces are always derived from template) */
    get hrefBase(): `/${string}` {
      return this.template.baseHref()
    }

    /** Converts hrefBase from RFC 6570 syntax to Fastify colon parameters syntax */
    get path(): string {
      return uriTemplatePathToColon(this.hrefBase)
    }
  }

  /** Shared surface selectable by dispatch. */
  export class CommandSurface<Ext extends string> extends BaseCommandSurface {
    readonly dispatch: CommandDispatch<Ext>
    readonly operationId?: string
    readonly description?: string
    readonly responses?: readonly ResponseEntry[]
    readonly responseSchemaUrn?: string

    constructor(plain: PlainCommonCommandSurface<Ext>) {
      super(plain)
      assert(plain.dispatch, 'CommandSurface.dispatch is required')
      this.dispatch = plain.dispatch
      this.operationId = plain.operationId
      this.description = plain.description
      this.responses = plain.responses
      this.responseSchemaUrn = plain.responseSchemaUrn
    }
  }

  /** One-off surface used only by a single command capability (not dispatch-addressable). */
  export class CustomCommandSurface extends BaseCommandSurface {
    readonly name?: string
    readonly operationId?: string
    readonly description?: string
    readonly responses?: readonly ResponseEntry[]
    readonly responseSchemaUrn?: string

    constructor(plain: PlainCustomCommandSurface) {
      super(plain)
      this.name = plain.name
      this.operationId = plain.operationId
      this.description = plain.description
      this.responses = plain.responses
      this.responseSchemaUrn = plain.responseSchemaUrn
    }
  }

  export type Adapter = (oldData: unknown) => unknown
  export type Hydrator = (validated: unknown) => unknown

  interface CommandCapabilityEnvelope<Ext extends string> {
    readonly cap: PlainCommandCapability<Ext>
    isLatest: boolean
  }

  export class CommandCapability<Ext extends string> {
    readonly id: string
    /** Present only for shared-surface commands. */
    readonly dispatch?: CommandDispatch<Ext>
    /** Present only for custom-endpoint commands. */
    readonly surface?: CustomCommandSurface

    /** Optional discriminator for envelope-style /command endpoint bodies. */
    readonly commandType?: string

    /** Defaults to false; deprecated commands remain documented for a deprecation window. */
    readonly deprecated: boolean

    /** Version-independent identifier grouping multiple versions of the same logical command. */
    readonly stableId: string

    /** JSON Schema describing the request body for this command version. */
    readonly schema?: JSONSchema7

    /** Semantic version of this command capability. */
    readonly version: string

    /** True if this is the latest (highest semver) version within its stableId group. */
    readonly isLatest: boolean

    /** Response documentation. Overrides dispatch surface defaults when provided. */
    readonly responses?: readonly ResponseEntry[]
    readonly responseSchemaUrn?: string

    /** Workflow annotation declaring chained operation semantics. */
    readonly workflow?: Workflow

    /** Human-readable description of what this command does. */
    readonly description?: string

    /** Runtime adapter that transforms old-version data to the current shape. */
    readonly adapt?: Adapter

    /** Runtime hydrator that converts validated data into the domain command shape. */
    readonly hydrate?: Hydrator

    constructor(envelope: CommandCapabilityEnvelope<Ext>) {
      const plain = envelope.cap
      assert(plain.id, 'CommandCapability.id is required')

      this.id = plain.id
      this.commandType = plain.commandType
      this.deprecated = plain.deprecated ?? false
      this.stableId = plain.stableId
      this.schema = plain.schema
      this.description = plain.description
      this.responses = plain.responses
      this.responseSchemaUrn = plain.responseSchemaUrn
      this.workflow = plain.workflow
      this.version = plain.version
      this.isLatest = envelope.isLatest
      this.adapt = plain.adapt
      this.hydrate = plain.hydrate

      const hasDispatch = 'dispatch' in plain
      const hasSurface = 'surface' in plain

      assert(
        !(hasDispatch && hasSurface),
        `CommandCapability must define exactly one of dispatch or surface (${this.id})`,
      )
      assert(
        hasDispatch || hasSurface,
        `CommandCapability must define dispatch or surface (${this.id})`,
      )

      if (hasDispatch) {
        const d = (plain as PlainCommonCommandCapability<Ext>).dispatch
        assert(d, `CommandCapability.dispatch is required (${this.id})`)
        this.dispatch = d
        return
      }

      const s = (plain as PlainCustomCommandCapability).surface
      assert(s, `CommandCapability.surface is required (${this.id})`)
      this.surface = new CustomCommandSurface(s)
    }
  }

  /**
   * CQRS command docs
   *
   * Conventions:
   * - Standard command endpoint is singular: POST /api/<svc>/<aggregate>/{id}/command
   * - Envelope-style commands use body: { type: <commandType>, data: ... }
   * - Custom endpoints (like room's /association) use surfaceOverride.
   */
  export class CommandsDef<Ext extends string> {
    readonly surfaces: readonly CommandSurface<Ext>[]
    readonly commands: readonly CommandCapability<Ext>[]

    private readonly _surfaceByDispatch: Map<CommandDispatch<Ext>, CommandSurface<Ext>>

    constructor(plain: PlainCommandsDef<Ext>) {
      assert(plain.surfaces?.length, 'CommandsDef.surfaces must be non-empty')
      assert(plain.commands?.length, 'CommandsDef.commands must be non-empty')

      this.surfaces = plain.surfaces.map((s) => new CommandSurface<Ext>(s))

      const envelopes: CommandCapabilityEnvelope<Ext>[] = plain.commands.map((c) => ({
        cap: c,
        isLatest: false,
      }))

      // Group by stableId and mark the highest semver as latest
      const groups = new Map<string, CommandCapabilityEnvelope<Ext>[]>()
      for (const env of envelopes) {
        const key = env.cap.stableId
        let group = groups.get(key)
        if (!group) {
          group = []
          groups.set(key, group)
        }
        group.push(env)
      }
      for (const group of groups.values()) {
        group.sort((a, b) => semverDesc(a.cap.version, b.cap.version))
        const latest = group[0]
        assert(latest, 'CommandsDef: empty stableId group (unreachable)')
        latest.isLatest = true
      }

      this.commands = envelopes.map((e) => new CommandCapability<Ext>(e))
      this._surfaceByDispatch = new Map<CommandDispatch<Ext>, CommandSurface<Ext>>()

      for (const s of this.surfaces) {
        assert(
          !this._surfaceByDispatch.has(s.dispatch),
          `Duplicate CommandSurface dispatch: ${s.dispatch}`,
        )
        this._surfaceByDispatch.set(s.dispatch, s)
      }

      // Validate that every shared-surface command can resolve to a surface
      for (const c of this.commands) {
        if (c.surface) continue

        const dispatch = c.dispatch
        assert(
          dispatch,
          `Command ${c.id} is missing dispatch and surface. Exactly one must be specified.`,
        )
        assert(
          this._surfaceByDispatch.has(dispatch),
          `No CommandSurface found for dispatch "${dispatch}" (command ${c.id})`,
        )
      }

      // Validate commandType presence only when effective endpoint is /command
      for (const c of this.commands) {
        const surf = c.surface ?? this.mustSurface(c.dispatch!)
        const endsWithCommand = surf.hrefBase.endsWith('/command')
        assert(
          !endsWithCommand || c.commandType,
          `Command ${c.id} targets a "/command" endpoint but is missing commandType.`,
        )
      }
    }

    getStableId(commandType: string): string {
      const cap = this.commands.find((c) => c.commandType === commandType)
      assert(cap, `CommandsDef.getStableId: no command found for commandType: ${commandType}`)
      return cap.stableId
    }

    resolveSurfaceForCommand(commandId: string): CommandSurface<Ext> | CustomCommandSurface {
      const c = this.commands.find((x) => x.id === commandId)
      assert(c, `Unknown command id: ${commandId}`)
      return c.surface ?? this.mustSurface(c.dispatch!)
    }

    mustSurface(dispatch: CommandDispatch<Ext>): CommandSurface<Ext> {
      const s = this._surfaceByDispatch.get(dispatch)
      assert(s, `Missing CommandSurface for dispatch: ${dispatch}`)
      return s
    }
  }

  export class QuerySurface {
    private _hrefBase?: `/${string}`
    readonly formats: readonly string[]
    readonly profile: string
    readonly template: IriTemplate
    readonly href?: `/${string}`
    readonly operationId?: string
    readonly description?: string
    readonly responses?: readonly ResponseEntry[]
    readonly responseSchemaUrn?: string

    constructor(plain: ResourceSurface | CollectionSurface) {
      const {
        formats,
        profile,
        template,
        href,
        operationId,
        description,
        responses,
        responseSchemaUrn,
      } = plain
      assert(formats?.length, 'QuerySurface.formats must be non-empty')
      assert(profile, 'QuerySurface.profile is required')
      this.formats = formats
      this.profile = profile
      this.template = new IriTemplate(
        template.id,
        template.template,
        template.mappings,
        template.variableRepresentation,
      )
      this.href = href
      this.operationId = operationId
      this.description = description
      this.responses = responses
      this.responseSchemaUrn = responseSchemaUrn
    }

    /** Non-templated canonical href (override or derived) */
    get hrefBase(): `/${string}` {
      return (this._hrefBase ??= this.href ?? this.template.baseHref())
    }

    /** Converts hrefBase from RFC 6570 syntax to Fastify colon parameters syntax */
    get path(): string {
      return uriTemplatePathToColon(this.hrefBase)
    }

    toHalCollectionLinks() {
      return {
        collection: { href: this.hrefBase },
        search: { href: this.template.template, templated: true as const },
      }
    }

    toHalItemLinks() {
      return {
        collection: { href: this.hrefBase },
      }
    }
  }

  type ItemEventsProp<E> = E extends { item: EventsResourceConfig } ? QuerySurface : undefined
  type AggregateEventsProp<E> = E extends { aggregate: EventsResourceConfig }
    ? QuerySurface
    : undefined

  class BaseRepresentation {
    constructor(
      readonly resource: QuerySurface,
      readonly collection: QuerySurface,
    ) {}

    // Convenience accessors for HAL rendering
    get resourceHref(): `/${string}` {
      return this.resource.hrefBase
    }
    /** Converts resourceHref from RFC 6570 URI Template syntax to Fastify colon parameters syntax */
    get resourcePath(): string {
      return uriTemplatePathToColon(this.resource.hrefBase)
    }
    get collectionHref(): `/${string}` {
      return this.collection.hrefBase
    }
    get collectionPath(): string {
      return uriTemplatePathToColon(this.collection.hrefBase)
    }
    get collectionTemplate(): string {
      return this.collection.template.template
    }
    toHalCollectionLinks() {
      return this.collection.toHalCollectionLinks()
    }
  }

  const LIMIT_PARAM = 'limit'
  const AFTER_POSITION_PARAM = 'afterPosition'

  export class Representation<
    E extends EventsConfig | undefined = undefined,
  > extends BaseRepresentation {
    readonly id: string
    readonly version: string
    readonly deprecated?: boolean

    readonly itemEvents: ItemEventsProp<E>
    readonly aggregateEvents: AggregateEventsProp<E>

    constructor(plain: PlainRepresentation<E>) {
      super(new QuerySurface(plain.resource), new QuerySurface(plain.collection))
      this.id = plain.id
      this.version = plain.version
      this.deprecated = plain.deprecated

      assert(this.id, 'Representation.id is required')
      assert(this.version, 'Representation.version is required')
      assert(
        this.collection.template.hasQueryExpansion(),
        `Collection template must contain query expansion: ${this.collection.template.template}`,
      )

      // ---- build events surfaces ----
      if (plain.events) {
        const ev = plain.events
        const formats: readonly string[] = ['application/json', 'application/hal+json']
        const verU = this.version.replaceAll('.', '_')
        const idStem = this.id.replace(/-v\d+_\d+_\d+$/, '') // e.g. "#pms-asset"

        // Single item collection events
        if ('item' in ev && ev.item) {
          const itemId = ev.item.id ?? `${idStem}-item-events-v${verU}`
          const idMap = requiredIdMapping(this.resource.template) // reuse required {id} mapping
          this.itemEvents = new QuerySurface({
            formats,
            profile: ev.item.profile, // profile is REQUIRED, provided by caller
            template: {
              id: itemId,
              template: `${this.resource.hrefBase}/events`,
              mappings: [
                idMap,
                { variable: LIMIT_PARAM, property: 'svc:limit' },
                { variable: AFTER_POSITION_PARAM, property: 'svc:afterPosition' },
              ],
            },
            href: `${this.resource.hrefBase}/events`,
          }) as ItemEventsProp<E>
        } else {
          this.itemEvents = undefined as ItemEventsProp<E>
        }

        // Aggregate-wide aggregate events
        if (ev.aggregate) {
          const colId = ev.aggregate.id ?? `${idStem}-aggregate-events-v${verU}`
          this.aggregateEvents = new QuerySurface({
            formats,
            profile: ev.aggregate.profile,
            template: {
              id: colId,
              template: `${ev.baseHref}/events/${ev.resourceSegment}`,
              mappings: [
                { variable: LIMIT_PARAM, property: 'svc:limit' },
                { variable: AFTER_POSITION_PARAM, property: 'svc:afterPosition' },
              ],
            },
            href: `${ev.baseHref}/events/${ev.resourceSegment}`,
          }) as AggregateEventsProp<E>
        } else {
          this.aggregateEvents = undefined as AggregateEventsProp<E>
        }
      } else {
        this.itemEvents = undefined as ItemEventsProp<E>
        this.aggregateEvents = undefined as AggregateEventsProp<E>
      }
    }

    toHalItemLinks() {
      return this.resource.toHalItemLinks()
    }
  }

  /**
   * ViewRepresentation explicitly models a "collection-only view" over an existing resource.
   *
   * - Members are the base resource (canonical identity and by-id route).
   * - The view defines only a collection/search surface with service-specific filters.
   */
  export class ViewRepresentation extends BaseRepresentation {
    readonly id: string
    readonly version: string
    readonly deprecated?: boolean

    constructor(plain: PlainViewRepresentation) {
      super(
        // Reuse canonical resource surface from base representation.
        plain.base.resource,
        new QuerySurface(plain.collection),
      )
      this.id = plain.id
      this.version = plain.version
      this.deprecated = plain.deprecated

      assert(this.id, 'ViewRepresentation.id is required')
      assert(this.version, 'ViewRepresentation.version is required')
      assert(plain.base, 'ViewRepresentation.base is required')
      assert(
        this.collection.template.hasQueryExpansion(),
        `Collection template must contain query expansion: ${this.collection.template.template}`,
      )
    }

    /**
     * HAL links that should accompany items *when they appear inside this view collection*.
     *
     * IMPORTANT: In a view, the item's canonical self link should still point to the base resource.
     * That "self" is typically set elsewhere when rendering the item itself.
     *
     * This helper provides "collection" pointing back to the view collection, not the canonical base.
     */
    toHalItemLinks(): { collection: { href: string } } {
      return {
        collection: { href: this.collection.hrefBase },
        // Optional nice-to-have later:
        // via: { href: this.collection.template.template, templated: true as const },
      }
    }
  }

  function requiredIdMapping(tpl: IriTemplate): IriTemplateMapping {
    const m = tpl.mappings.find((m) => m.required)
    assert(m, `Resource template is missing a required id mapping`)
    return m
  }
}
