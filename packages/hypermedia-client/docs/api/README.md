**@cqrs-toolkit/hypermedia-client**

---

# @cqrs-toolkit/hypermedia-client

Client-side counterpart to `@cqrs-toolkit/hypermedia`.
Consumes Hydra/HAL hypermedia API surfaces on the client, integrates with the offline-first `@cqrs-toolkit/client` to drive command surfaces and read-model seeding, and ships a `pull` CLI that generates typed TypeScript from your server's JSON Schemas.

## Entry points

| Import                                      | Purpose                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `@cqrs-toolkit/hypermedia-client`           | Runtime: `createCollection`, `getGeneratedIdReferences`, command sender, ... |
| `@cqrs-toolkit/hypermedia-client/config`    | `PullConfig` types for `cqrs-toolkit.config.ts`                              |
| `@cqrs-toolkit/hypermedia-client/internals` | CLI hooks for `@cqrs-toolkit/hypermedia-cli`                                 |

## What `pull` does

The `cqrs-toolkit client pull` CLI fetches your server's Hydra apidoc, downloads the JSON Schemas it references (commands + HAL representation response shapes + transitive `$ref` closure), and emits a generated tree under your `outputDir`:

```
src/cqrs/
├── commands/
│   ├── manifest.ts        Routing table + `AppCommand` discriminated union
│   └── types.ts           Command request-data interfaces
├── reps/
│   ├── manifest.ts        Representation surfaces (URLs/templates) + `generatedIdReferences`
│   └── types.ts           HAL representation interfaces
├── shared/
│   └── types.ts           Types referenced from both commands and reps
├── schemas/               Raw JSON schemas (one file per URN)
├── schemas.ts             AJV `SchemaRegistry`
└── meta.json
```

The pipeline is in-memory: bundle (hand-rolled, dedups by `svc:urn` / `$id`) → compile via `json-schema-to-typescript` → AST-classify via `typescript-estree` → assemble.
Cross-role references between `commands/` and `reps/` are a hard codegen error; the routing rule funnels schemas reachable from both roles to `shared/`.

## Setup

Add a `cqrs-toolkit.config.ts` at your project root (see `defineConfig` in `@cqrs-toolkit/hypermedia-cli/config`).

```ts
import { defineConfig } from '@cqrs-toolkit/hypermedia-cli/config'
import type { JSONSchema7 } from 'json-schema'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  client: {
    server: 'http://localhost:3002',
    apidocPath: '/api/meta/apidoc',
    outputDir: path.resolve(__dirname, 'src/cqrs'),

    // Command-surface envelopes wrap data in a $ref. Extract the data schema.
    extractCommand(schema: JSONSchema7): string | undefined {
      const dataRef = schema.properties?.['data']
      if (typeof dataRef === 'object' && dataRef !== null && '$ref' in dataRef) {
        return (dataRef as { $ref: string }).$ref
      }
      return undefined
    },

    commands: [
      // String form — no per-command typing.
      'urn:command:nb.CreateTodo:1.0.0',

      // Object form — adds idReferences for codegen typing on the command's
      // data schema.
      {
        urn: 'urn:command:nb.CreateNote:1.0.0',
        idReferences: [
          { kind: 'id', path: '$.notebookId', aggregateUrn: 'urn:aggregate:nb.Notebook' },
        ],
      },
    ],

    representations: [
      // String form.
      'urn:representation:nb.Notebook:1.0.0',

      // Object form — idReferences apply to the rep's HAL resource schema.
      // Self-id entries (no aggregateUrn) are codegen-typing-only.
      // Foreign-id entries (with aggregateUrn) also propagate to the rep
      // manifest's `generatedIdReferences` for `getGeneratedIdReferences`.
      {
        urn: 'urn:representation:nb.Note:1.0.0',
        idReferences: [
          { kind: 'id', path: '$.id' },
          { kind: 'id', path: '$.notebookId', aggregateUrn: 'urn:aggregate:nb.Notebook' },
        ],
      },
    ],

    // Required when any idReferences entry has `kind: 'link'`.
    // linkType: 'ServiceLink',
  },
})
```

Then run `cqrs-toolkit client pull`. (See [`hypermedia-cli`](../hypermedia-cli/README.md) for invocation.)
The demo wraps this with `make hm-client-pull` so it spins up the server, runs pull, and shuts down.

## `idReferences` — typed IDs and runtime collection wiring

`idReferences` is the single config concept that drives two outputs.

### What gets generated

For each entry in `idReferences`:

- **Codegen typing.** The codegen replaces the target field's generated type with `EntityId` (for `kind: 'id'`) or the configured `linkType` (`Link` / `ServiceLink`, for `kind: 'link'`).
  Example: `notebookId: string` becomes `notebookId: EntityId` in `cqrs/commands/types.ts`.
  Imports for the toolkit-external types are emitted automatically.
- **Runtime manifest output** (representations only). When the entry has an `aggregateUrn` (id-kind) or non-empty `aggregateUrns` (link-kind), the entry also appears in the rep's `generatedIdReferences` array in `cqrs/reps/manifest.ts`.
  Self-id entries (no aggregate) are typing-only and do not appear there.

### Path syntax

`path` uses the same JSONPath subset as `@cqrs-toolkit/client` — root `$`, dot member, bracket member, `[*]` wildcard, `[n]` index.
Navigation walks schema shape: `.foo` → `properties.foo`, `[*]` / `[n]` → `items`.
Examples:

- `$.id` — top-level id field.
- `$.notebookId` — top-level foreign id.
- `$._embedded.item[*].id` — every embedded item's id (in a HAL collection).

### Aggregate URN format

`urn:aggregate:{service.}{Type}` (e.g. `urn:aggregate:nb.Note`).
Unversioned — aggregates are long-lived; their representations are versioned.
You author these strings yourself; nothing in the toolkit derives them.

## Runtime wiring — `AggregateRegistry` + `getGeneratedIdReferences`

To use the generated `generatedIdReferences` at runtime, declare an `AggregateRegistry` once and call `getGeneratedIdReferences` when building a collection.

```ts
import { ClientAggregate, type EntityId } from '@cqrs-toolkit/client'
import { getGeneratedIdReferences, type AggregateRegistry } from '@cqrs-toolkit/hypermedia-client'
import type { ServiceLink } from '@meticoeus/ddd-es'
import { representations } from './cqrs/reps/manifest.js'

const NotebookAggregate = new ClientAggregate<ServiceLink>({
  service: 'nb',
  type: 'Notebook',
  getStreamId: (id: EntityId) => `nb.Notebook-${String(id)}`,
})
const NoteAggregate = new ClientAggregate<ServiceLink>({
  service: 'nb',
  type: 'Note',
  getStreamId: (id: EntityId) => `nb.Note-${String(id)}`,
})

// One registry, keyed by the same `urn:aggregate:*` strings used in your config.
export const aggregateRegistry: AggregateRegistry<ServiceLink> = {
  'urn:aggregate:nb.Notebook': NotebookAggregate,
  'urn:aggregate:nb.Note': NoteAggregate,
}

// Each Collection looks up its idReferences via the rep URN.
export const notesCollection = {
  name: 'notes',
  aggregate: NoteAggregate,
  idReferences: getGeneratedIdReferences(
    'urn:representation:nb.Note:1.0.0',
    representations,
    aggregateRegistry,
  ),
  // ... other Collection fields
}
```

`getGeneratedIdReferences` throws on:

- An unknown representation URN (not in the manifest).
- An aggregate URN referenced in `generatedIdReferences` but absent from the registry.

Both fail fast at app startup, so registry drift is caught immediately rather than silently routing entity refs to the wrong aggregate.

## Typed command handlers

Because `cqrs/commands/manifest.ts` emits `AppCommand` with each command's typed `data` field (sourced from the same generated request types), handlers narrowing on `command.type` get typed `command.data` automatically:

```ts
handler(command, _state, context) {
  // command.type === 'nb.CreateNote' narrows command.data to NbCreateNoteV1_0_0:
  //   { body: string; notebookId: EntityId; title: string }
  const { body, notebookId, title } = command.data
  // No `as { ... }` cast needed.
}
```

`path` variables are emitted as `EntityId` on each union member (e.g. `path: { id: EntityId }`).

## Cross-environment behaviour

Schemas are bundled by URN identity (`svc:urn` if present, else `$id`).
Pulling against any environment produces byte-identical generated TypeScript — only the per-deployment URLs in `cqrs/schemas/*.json` differ.

If your real-app deployments emit different schema-base URLs per environment, the codegen is environment-agnostic by construction.
Runtime AJV validation still uses the URL form of each schema's `$id` (as fetched), so the schemas folder is per-deployment.

## End-to-end checklist for a new consumer app

1. Add the dep: `npm i @cqrs-toolkit/hypermedia-client @cqrs-toolkit/hypermedia-cli` (plus `@cqrs-toolkit/client`).
2. Author `cqrs-toolkit.config.ts` with `commands` and `representations` — string form is fine to start.
3. Run `cqrs-toolkit client pull` (or `cqrs-toolkit client init` first if you want a scaffold).
4. Add `idReferences` entries to commands / reps that have foreign-aggregate fields.
   - For each foreign id, pick the target aggregate's URN (`urn:aggregate:{service.}{Type}`).
   - For self-ids, omit `aggregateUrn` — codegen typing only.
5. Define an `AggregateRegistry` mapping every `urn:aggregate:*` referenced in your config to a live `AggregateConfig`.
6. In each `Collection` declaration, call `getGeneratedIdReferences(repUrn, representations, registry)` for `idReferences`.
7. Use the discriminated `AppCommand` in handlers and rely on type narrowing instead of casts.

## See also

- [ADR-0003 — codegen pipeline + idReferences design](_media/0003-codegen-id-references.md) for the full rationale.
- [Schema → TS codegen exploration](_media/schema-to-ts-codegen.md) for the original design narrative and the library-evaluation checklist used during implementation.
- [Project castle](_media/_overview.md) for hypermedia-client's full landscape (intent, decisions, evolution).
