**@cqrs-toolkit/hypermedia**

---

# @cqrs-toolkit/hypermedia

CQRS-aware Hydra API documentation, HAL rendering, content negotiation, and embed planning for server-side hypermedia APIs.

Define versioned command and query surfaces with `HydraDoc`, render HAL+JSON responses with embedded resources and CURIEs, negotiate profiles via HTTP headers, plan command validation pipelines, and resolve `?include=` tokens into parallel data loads.

## Entry Points

The package has three entry points:

| Import                             | Purpose                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `@cqrs-toolkit/hypermedia`         | Core types: `HydraDoc`, `HAL`, `HypermediaTypes`, embed spec types                    |
| `@cqrs-toolkit/hypermedia/server`  | Server utilities: profile negotiation, command/embed planning, formatting, exceptions |
| `@cqrs-toolkit/hypermedia/builder` | Build-time tooling: generate Hydra ApiDocumentation JSON-LD from class definitions    |

## Defining API Surfaces

`HydraDoc` is the core namespace for declaring what your API exposes — versioned representations, query surfaces, and command capabilities.

### Representations

A `Representation` describes a versioned read model: its profile URN, media types, and surfaces for querying single items and collections.

```typescript
import { HydraDoc } from '@cqrs-toolkit/hypermedia'

const taskRep = new HydraDoc.Representation({
  id: 'task-v1',
  version: '1.0.0',
  resourceSurface: {
    profileUrn: 'urn:profile:pms:Task',
    mediaTypes: ['application/json'],
    template: new HydraDoc.IriTemplate({
      template: '/api/tasks/{id}',
      mappings: [{ variable: 'id', property: 'id' }],
    }),
  },
  collectionSurface: {
    profileUrn: 'urn:profile:pms:Task',
    mediaTypes: ['application/json'],
    template: new HydraDoc.IriTemplate({
      template: '/api/tasks{?status,limit,cursor}',
      mappings: [
        { variable: 'status', property: 'status' },
        { variable: 'limit', property: 'limit' },
        { variable: 'cursor', property: 'cursor' },
      ],
    }),
  },
})
```

### Command Capabilities

Commands are grouped into `CommandsDef` — a set of versioned capabilities with surfaces that describe how to invoke them.

```typescript
const taskCommands = new HydraDoc.CommandsDef({
  surfaces: HydraDoc.standardCommandSurfaces(
    new HydraDoc.IriTemplate({
      template: '/api/tasks/{id}/commands/{commandType}',
      mappings: [
        { variable: 'id', property: 'id' },
        { variable: 'commandType', property: 'commandType' },
      ],
    }),
    new HydraDoc.IriTemplate({
      template: '/api/tasks',
      mappings: [],
    }),
  ),
  capabilities: [
    {
      id: 'RenameTask-1.0.0',
      stableId: 'RenameTask',
      version: '1.0.0',
      commandType: 'RenameTask',
      dispatch: 'command',
      schema: taskRenameSchema,
    },
  ],
})
```

## HAL Rendering

The `HAL` namespace renders resource and collection descriptors into HAL+JSON, handling `_links`, `_embedded`, and CURIEs.

```typescript
import { HAL } from '@cqrs-toolkit/hypermedia'

// Single resource
const hal = HAL.fromResource(resourceDescriptor, resourceDefinition, { idKey: 'id' })

// Collection with pagination
const halCollection = HAL.fromCollection(
  collectionDescriptor,
  resourceDefinition,
  collectionDefinition,
  { idKey: 'id' },
)
```

## Server Utilities

### Profile Negotiation

`ProfileNegotiator` handles `Accept-Profile` / `Content-Profile` header negotiation, selecting the best version from registered profiles.

```typescript
import { ProfileNegotiator } from '@cqrs-toolkit/hypermedia/server'

const negotiator = new ProfileNegotiator([
  { urn: 'urn:profile:pms:Task', version: '1.0.0', representation: taskRepV1 },
  { urn: 'urn:profile:pms:Task', version: '2.0.0', representation: taskRepV2 },
])

const result = negotiator.negotiate(request, reply)
// result.kind: 'none' (no profile requested) | 'matched' | 'replied' (406)
```

`ProfileHandler` wraps the negotiator with `Result<T, E>` integration for query endpoints.

### Command Planning

`CommandPlanner` negotiates command versions, validates payloads against JSON Schema, and chains adapters for backwards compatibility.

```typescript
import { CommandPlanner } from '@cqrs-toolkit/hypermedia/server'

const planner = new CommandPlanner(taskCommands, extractDispatch, validate)

const negotiated = planner.negotiate(request, reply)
const validated = planner.validate(negotiated, requestBody)
const hydrated = planner.hydrate(validated)
```

### Embed Planning

`EmbedPlanner` validates `?include=` tokens, resolves parent dependencies, and executes resolvers in parallel.

```typescript
import { EmbedPlanner } from '@cqrs-toolkit/hypermedia/server'

const planner = new EmbedPlanner(embeddableSpecs, { maxIncludes: 3 })

const result = await planner.resolve(
  request.query, // e.g. { include: 'pms:DataTag,pms:Category' }
  params,
  locals,
  context,
)
// result: EmbeddedOutput keyed by className
```

### Response Formatting

`Hypermedia` provides helpers that combine descriptors with HAL rendering and pagination.

```typescript
import { Hypermedia } from '@cqrs-toolkit/hypermedia/server'

// Build a collection descriptor from a cursor-paginated query result
const descriptor = Hypermedia.buildCollectionDescriptor(connection, toResourceDescriptor)

// Format as HAL with pagination links
const body = Hypermedia.formatCollection(descriptor, {
  resourceDefs,
  collectionDef,
  idKey: 'id',
})
```

### Exceptions

Typed HTTP exceptions for common error responses:

- **4xx**: `BadRequestException`, `ForbiddenException`, `NotFoundException`, `TooManyIncludesException`
- **5xx**: `InternalErrorException`, `BadGatewayException`, `GatewayTimeoutException`
- `toUpstreamException(err)` maps Node network errors (ETIMEDOUT, ECONNREFUSED, etc.) to the appropriate exception

## Builder

Generate Hydra ApiDocumentation JSON-LD and JSON Schema files from your class definitions at build time.

```typescript
import {
  buildHydraApiDocumentation,
  generateHydraDocumentation,
} from '@cqrs-toolkit/hypermedia/builder'

const result = buildHydraApiDocumentation({
  classes: [taskClassDef, projectClassDef],
  prefixes: ['pms'],
})

// Write JSON-LD and schemas to disk
await generateHydraDocumentation({
  buildResult: result,
  outDir: './hydra',
})
```

## API Reference

Full API documentation is generated from source and available at [docs/api](_media/README.md).

Key entry points:

- [`HydraDoc`](_media/README-1.md) — Command/query surface definitions
- [`HAL`](_media/README-2.md) — HAL+JSON rendering
- [`ProfileNegotiator`](_media/ProfileNegotiator.md) — HTTP profile negotiation
- [`ProfileHandler`](_media/ProfileHandler.md) — Profile handler with Result integration
- [`CommandPlanner`](_media/CommandPlanner.md) — Command version negotiation and validation
- [`EmbedPlanner`](_media/EmbedPlanner.md) — Include token resolution
- [`Hypermedia`](_media/README-3.md) — Response formatting utilities
- [`buildHydraApiDocumentation`](_media/buildHydraApiDocumentation.md) — Build-time documentation generator
