# ADR 0003 (hypermedia-client) — Schema → TS codegen with `idReferences` and `AggregateRegistry`

**Status:** Accepted (2026-05-25)

## Context

`cqrs-toolkit client pull` already fetches every command request schema, every command/representation response schema (preferring `application/hal+json`), and their transitive `$ref` closure.
It writes the raw schemas to `cqrs/schemas/`, an AJV registry to `cqrs/schemas.ts`, and a runtime `RepresentationManifest` of surface URLs/templates to `cqrs/representations.ts`.
Type information from those schemas — what shape a command's `data` field has, what shape a representation's `_embedded.item` entries have — only existed implicitly: consumers re-typed payloads by hand with `as { prop: X }` casts in handlers and could not statically catch a mismatched field name.

Two further gaps shaped the design once codegen was on the table:

- **Cross-deployment identity.**
  Schemas served by `hypermedia-server` carry a per-deployment URL-rewritten `$id` (e.g. `http://localhost:3002/api/meta/schemas/urn/schema/nb.Note/1.0.0.json`) and the host-invariant URN under `svc:urn` (e.g. `urn:schema:nb.Note:1.0.0`).
  Schemas pulled from different environments differ only in the URL; URN-keyed dedup is what makes a single codegen pipeline work across deployments.
  (See [`docs/projects/hypermedia/explorations/jsonschema-ref-class.md`](../../hypermedia/explorations/jsonschema-ref-class.md) for the server-side context.)
- **Semantic typing of IDs and Links.**
  JSON Schema declares `id`, `notebookId`, `_links.x` as plain `string` / `object`.
  Consumers want them typed as `EntityId` / `Link` / `ServiceLink` so handlers and view code don't paper over the brand mismatch.
  Aggregate-target information (which aggregate an ID points to) belongs to the consumer config, not the JSON Schemas: baking unresolvable `$ref` URNs into JSON Schemas would render them invalid against vanilla validators, and a generic `EntityId` (no target aggregate) is too coarse for ID-disambiguation at the type level. The Hydra apidoc already encodes target-types in mappings, but mapping those onto schema fields automatically is deferred — for now, consumers author `aggregateUrn` directly on each `idReferences` entry.

The full design exploration is at [`../explorations/schema-to-ts-codegen.md`](../explorations/schema-to-ts-codegen.md).

## Decision

`pull` runs a four-stage in-memory codegen pipeline after the existing fetch/extraction.
The pipeline is wrapped by `generateTypes` in [`packages/hypermedia-client/src/cli/type-codegen.ts`](../../../../packages/hypermedia-client/src/cli/type-codegen.ts) and runs on schemas resolved post-envelope-extraction.

```
fetched schemas (in memory) → bundler → compiler adapter → AST classifier → assembler → write
```

Output: three TS files under `cqrs/{commands,reps,shared}/types.ts` plus an augmented `cqrs/{commands,reps}/manifest.ts`.

### Bundler

[`schema-bundler.ts`](../../../../packages/hypermedia-client/src/cli/schema-bundler.ts) walks the closure, dedups by URN identity (`svc:urn` if present, else `$id`), rewrites every external `$ref` to an internal `#/definitions/<name>` pointer.
A separate `aliasToCanonical` map indexes both URN and URL aliases of each schema so `$ref`s in URL form resolve against schemas whose canonical identity is the URN form.
Type names come from `title`; throws on title collisions across distinct URNs.

### Compiler adapter

[`json-schema-compiler.ts`](../../../../packages/hypermedia-client/src/cli/json-schema-compiler.ts) defines `JsonSchemaToTsCompiler.compile(bundle): Promise<string>` and ships a `json-schema-to-typescript` (bcherny) implementation.
The interface is the only place library-specific code lives — swap the adapter to swap the compiler.
Configured with `unreachableDefinitions: true`, `enableConstEnums: false` (string-literal unions), `additionalProperties: false`, `unknownAny: true`.

### AST classifier + cross-role validation

[`classifier.ts`](../../../../packages/hypermedia-client/src/cli/classifier.ts) parses the compiler output with `typescript-estree` and classifies each top-level declaration by URN-reachability into `shared` / `commands` / `reps`.
Routing rule:

- Top-level commands (URNs in `client.commands[]` post-extraction) → `commands/`.
- Top-level reps (URNs in `client.representations[]`'s HAL resource surface) → `reps/`.
- Other reachable schemas: classified by which roles can reach them; reachable from both → `shared/`.

A declaration in `commands/` that references a declaration in `reps/` (or vice versa) is a hard error.
Unexpected idents (declarations the compiler emitted that aren't in our `title` set) are surfaced as warnings.

### Assembler

[`assembler.ts`](../../../../packages/hypermedia-client/src/cli/assembler.ts) sorts declarations by name within each file, computes per-file imports (commands/reps may only import from shared), and slices declaration source ranges from the compiler output.

### Per-field `idReferences` (codegen typing + manifest output)

Consumer config attaches `idReferences` to individual command / representation entries.
Each entry's `paths` annotate fields in the corresponding schema:

```ts
{
  urn: 'urn:representation:nb.Note:1.0.0',
  idReferences: [
    { kind: 'id', path: '$.id' },                                                     // self-id: typing only
    { kind: 'id', path: '$.notebookId', aggregateUrn: 'urn:aggregate:nb.Notebook' },  // foreign id
  ],
}
```

The bundler applies these to the corresponding schema, replacing each target field with a `$ref` to a synthetic `__External_<EntityId|Link|ServiceLink>` definition.
Synthetic definitions emit through the compiler; the classifier filters them; the assembler rewrites `__External_<X>` tokens in slices back to `<X>` and emits the corresponding `import type { <X> } from '@cqrs-toolkit/client' | '@meticoeus/ddd-es'`.
For `kind: 'link'` entries, the user-supplied `linkType: 'Link' | 'ServiceLink'` (validated as required when any link entry is present) controls which type is imported.

Entries with `aggregateUrn` (id-kind) or non-empty `aggregateUrns` (link-kind) additionally propagate to the rep manifest entry's new `generatedIdReferences` field.
Self-id entries (no aggregate) are typing-only — they do not appear in `generatedIdReferences`.

### Runtime: `AggregateRegistry` + `getGeneratedIdReferences`

[`runtime/get-generated-id-references.ts`](../../../../packages/hypermedia-client/src/runtime/get-generated-id-references.ts) exports:

```ts
type AggregateRegistry<TLink> = Record<string, AggregateConfig<TLink>> // keyed by urn:aggregate:*

function getGeneratedIdReferences<TLink, K extends string = string>(
  representationUrn: string, // e.g. 'urn:representation:nb.Note:1.0.0'
  manifest: { [P in K]: RepresentationSurfaces },
  registry: AggregateRegistry<TLink>,
): IdReference<TLink>[]
```

The `manifest` parameter uses a mapped type with `K` inferred at the call site rather than `Record<string, RepresentationSurfaces>` so the codegen's narrow `Representations` interface (with literal `'demo:Todo' | 'demo:Note' | ...` keys) passes through unchanged — no index signature on the manifest, narrow `keyof typeof representations` preserved for consumers.

The consumer maintains the registry once (mapping each `urn:aggregate:{service.}{Type}` URN that appears in their `cqrs-toolkit.config.ts` to a live `AggregateConfig`) and calls `getGeneratedIdReferences` when building a `Collection`.
Throws on unknown representation URN or unregistered aggregate URN.

### Manifest output shape

`RepresentationSurfaces` gains two fields: `urn` (the rep URN, enabling URN-keyed lookup) and an optional `generatedIdReferences: GeneratedIdReference[]`.
The generated `Representations` interface in `reps/manifest.ts` keeps literal-key entries (`'demo:Todo': RepresentationSurfaces; 'demo:Note': RepresentationSurfaces; ...`) with no index signature — `keyof typeof representations` remains a narrow union for consumer autocomplete.

## Consequences

### Implementation impact

- New CLI modules: `schema-bundler.ts`, `json-schema-compiler.ts`, `classifier.ts`, `assembler.ts`, `schema-path.ts`, `type-codegen.ts` (orchestrator).
- Runtime additions: `GeneratedIdReference` type, `AggregateRegistry` type, `getGeneratedIdReferences` helper.
- `PullConfig` reshape: `representations: string[]` → `representations: RepresentationEntry[]`; `linkType?: 'Link' | 'ServiceLink'` at top level; per-entry `idReferences?: IdReferenceEntry[]` on commands and reps; no top-level `typedPaths`.
- `ts-writer` emits `cqrs/{commands,reps,shared}/types.ts`, relocates `commands.ts → commands/manifest.ts` and `representations.ts → reps/manifest.ts`, and threads `commandDataTypeNames` so the `AppCommand` union references generated types instead of `data: unknown`.
- `apidoc-representations` surfaces per-surface response schemas plus the rep URN; the fetcher pulls response schemas alongside command schemas and prefers HAL when both content-types are advertised.
- The closure-pruning step in `applyEnvelopeExtraction` walks refs from both commands and responses, so HAL collection → HAL resource embedding refs survive.
- New dependency: `json-schema-to-typescript`. No `@apidevtools/json-schema-ref-parser` dependency — bundling is hand-rolled.
- Server-side: `buildCommandSchema` injects `Body` before the `Vn_n_n` version suffix on envelope titles to keep them distinct from inner-data titles.

### Operational implications

#### Gains

- Codegen runs as part of `pull`; no separate step.
- One source of truth for ID-bearing fields: consumer `idReferences` config feeds both codegen typing AND runtime collection wiring.
- Pulling from any environment (dev, staging, prod) produces byte-identical TS output thanks to URN-canonical bundling — only the per-deployment URLs in `schemas/*.json` differ.

#### Costs

- `pull` is heavier (bundle + compile + AST parse + assemble). Acceptable at build/dev time; not a runtime concern.
- Schemas with two distinct URNs sharing a `title` are rejected hard at bundle time (no silent overwrite). This caught the envelope/data title collision in the demo and led to the server-side `Body` suffix; future authoring needs to mind title uniqueness.

### Coding implications

#### Gains

- Handler narrowing on `command.type` lights up typed `command.data` automatically — handler casts like `as { content: string }` collapse.
- Read models gain semantically-typed IDs (`id: EntityId`, `notebookId: EntityId`) when annotated.
- `createCollection`'s `idReferences` is generated; consumers stop hand-mirroring foreign-aggregate paths.
- Compiler adapter is swappable — if `json-schema-to-typescript` ever produces junk, swap the adapter without touching the rest of the pipeline.

#### Costs

- Consumer must maintain `aggregateRegistry` in sync with the `aggregateUrn` references in their config. An unregistered URN is a hard runtime error from `getGeneratedIdReferences`, so drift is caught at app startup rather than silently mis-routing.
- Per-deployment URL rewrites still bake into `schemas/*.json` artifacts. The runtime AJV registry uses these as-is; cross-environment runtime hydration of schemas remains future work.

## Alternatives considered

**Top-level `typedPaths: TypedPathsForSchema[]` array keyed by schema URN (initial design).**
Considered and shipped first. Rejected in favour of per-entry `idReferences` because it duplicated the URN list (every annotated schema appeared in both `commands`/`representations` and `typedPaths`) and required consumers to know the data-schema URN vs the command/rep URN.

**Field-name heuristic for ID detection (regex match `^id$|Id$`).**
Considered. Rejected — brittle (false positives on `paid`, `void`, `androidId`-ish names) and doesn't carry aggregate-target information needed for `generatedIdReferences`.

**JSON Schema custom keyword (`svc:type: 'entityId'`) on the field.**
Considered. Rejected for v1 — invasive to schema authoring, and consumers already author target-type info in the apidoc; the consumer-config approach kept the source-of-truth in one place.

**Well-known schema URN `$ref`s (`$ref: "urn:toolkit:EntityId:1.0.0"`).**
Considered and rejected: those URNs don't resolve to real schemas, so the document is invalid against vanilla JSON Schema validators.

**Generic `EntityId` everywhere (no target aggregate).**
Considered. Rejected: too coarse — distinguishing a notebook ID from a note ID at the type level is the consumer's actual ask.

**`@apidevtools/json-schema-ref-parser` for bundling.**
Initial scope. Replaced with the hand-rolled ~50-line bundler because we already control the closure and need URN-keyed dedup which the library doesn't provide directly.

**Empirical-check phase (one-off scratch script before main implementation).**
Initial scope. Skipped; built production-ready modules with tests as the runners, and the first end-to-end pull answered the original Q1–Q8 directly.

**Embed envelope schemas in codegen output.**
Considered as a follow-up to expose request-body types (`{ type, data, revision }`). Rejected for v1 — envelope extraction is the existing pipeline behaviour and we keep emitting only the inner data shape per the runtime envelope-extraction contract.

## Related

- Sourced from exploration: [`../explorations/schema-to-ts-codegen.md`](../explorations/schema-to-ts-codegen.md). The exploration persists past this ADR's acceptance, kept for the original library-evaluation checklist (Q1–Q8) and the empirical-check approach that was scoped out.
- Hypermedia-castle context: [`../../hypermedia/explorations/jsonschema-ref-class.md`](../../hypermedia/explorations/jsonschema-ref-class.md) — server-side `svc:urn` / `svc:JsonSchemaRef` discussion that motivated the URN-canonical bundler design.
- [ADR-0001](0001-create-collection-seed-records-wiring.md) / [ADR-0002](0002-create-collection-contributor-shape.md): shape `createCollection` as a contributor; `idReferences` on the resulting `Collection` is the input `getGeneratedIdReferences` produces.
- Server-side `buildCommandSchema` adjustment lives in [`demos/hypermedia-server/src/command-utils.ts`](../../../../demos/hypermedia-server/src/command-utils.ts).
