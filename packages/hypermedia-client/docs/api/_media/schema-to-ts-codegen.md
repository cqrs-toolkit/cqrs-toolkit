# Schema-to-TS Codegen — Implementation Plan

## Status

Resolved 2026-05-25 → [ADR-0003](../decisions/0003-codegen-id-references.md).
The bundle → compile → classify → assemble pipeline shipped substantially as described below; per-entry `idReferences` replaced the originally proposed top-level `typedPaths` array; the empirical-check ceremony was scoped out in favour of production-ready modules with tests as runners.
This document persists for the original library-evaluation checklist (Q1–Q8) and as the design-intent record; the consumer-facing usage guide is in [`packages/hypermedia-client/README.md`](../../../../packages/hypermedia-client/README.md).

## Context

We are adding TypeScript type generation to the hypermedia client SDK.
Source-of-truth is the server's JSON Schemas (target consumer has 464 of them) served from the API.
The codegen reads them, produces typed TS that consumers import alongside the existing runtime `representations` map.

This document covers the codegen step.
The prerequisite server-side work is tracked separately and must land first:

- Adding `title` to schemas.
- Stamping `svc:urn` during the build's URN-to-URL rewrite.
- Switching `svc:jsonSchema` to object form in the Hydra docs (see [`jsonschema-ref-class.md`](../../hypermedia/explorations/jsonschema-ref-class.md) in the hypermedia castle).
- Vocabulary entries for `svc:JsonSchemaRef`.

## Pipeline Overview

```
schemas fetched from server, held in memory (string or object form)
  ↓ bundle via hand-rolled walker (~30–50 lines)
bundle: single JSON Schema doc (refs rewritten to internal #/definitions/..., dedup by svc:urn)
  ↓ compile via pluggable JsonSchemaToTsCompiler adapter
generated TS source (string)
  ↓ parse with @typescript-eslint/typescript-estree
  ↓ detect unexpected (synthetic) idents → log count + names
  ↓ classify each declaration by role (shared / commands / reps)
  ↓ validate references (no cross-role imports between commands and reps)
  ↓ compute imports per file
  ↓ sort declarations by name within each file
  ↓ assemble three output files as plain strings
write src/cqrs/shared/types.ts, src/cqrs/commands/types.ts, src/cqrs/reps/types.ts
  ↓ tsc --noEmit
done
```

The entire pipeline runs in memory — no intermediate files until the final write. Total expected size: a few hundred lines of TypeScript.

## Library Decisions

- **Bundling**: hand-rolled walker over the fetched closure (~30–50 lines). Rewrites every external URL `$ref` into an internal `#/definitions/<name>` pointer, deduplicating by `svc:urn`. No library dependency.
- **Codegen**: pluggable `JsonSchemaToTsCompiler` adapter. The adapter is the only place library-specific code lives — swap implementations by changing what's imported, with no other pipeline changes. Interface is narrow: `compile(bundle: JsonSchema) => Promise<string>`. If a candidate library outputs an AST instead of a string, the adapter for that library converts internally so the rest of the pipeline always sees a string.
- **Initial codegen library**: `json-schema-to-typescript` (bcherny). If its output is junk on real schemas, swap the adapter for another JSON Schema 7 codegen library (quicktype, dtsgenerator, json-to-ts, etc.). Forking-and-vendoring a working candidate is the deeper fallback.
- **Parsing**: `@typescript-eslint/typescript-estree` (already in the CLI). Used for declaration enumeration, identifier collection, and range-based source slicing.
- **Output assembly**: plain string concatenation. Not magic-string (this is fresh assembly, not mutation-in-place).
- **Validation**: `tsc --noEmit` post-write check.

## Config Inputs

Reads existing config (`client.commands[]`, `client.representations[]`) for top-level URN lists.
Reads `client.extractCommand` to find the payload schema URN from a command-surface envelope.
Reads `client.outputDir` for the output root.

Adds new config (proposed):

- `outputLayout` (optional, default: `{ shared: 'shared/types.ts', commands: 'commands/types.ts', reps: 'reps/types.ts' }`) — paths relative to `outputDir`.
- `bannerComment` (optional, default: a "Generated. Do not edit." notice) — passed to `json-schema-to-typescript`.

## Routing Rule

For each schema in the bundle (keyed by `svc:urn`):

1. **Top-level commands** (URNs listed in `client.commands[]`, resolved to payload schemas via `extractCommand`) → `commands/`.
2. **Top-level representations** (URNs listed in `client.representations[]`, expanded to their referenced schemas across all surfaces — `resource`, `collection`, `itemEvents`, `aggregateEvents`) → `reps/`.
3. **Anything else reachable** via `$ref` from one or more top-level entries → classified by role-reachability:
   - Reachable from only commands → `commands/`.
   - Reachable from only reps → `reps/`.
   - Reachable from both → `shared/`.

**Top-level entries stay in their own role's directory even if they're referenced from another role.**
Reachability is computed outward from top-level entries, not into them.

## Cross-Role Reference Rule

After classification, scan each declaration's body for type references.
Valid imports:

- `shared/` imports: none.
- `commands/` imports: only from `shared/`.
- `reps/` imports: only from `shared/`.

Any reference from `commands/` to `reps/` or vice versa is a hard codegen error with a message naming the offending type and its reference.
This shouldn't happen given correct schemas — read models and command payloads are structurally independent — but we enforce it because the alternative is a confusing tsc error downstream.

## Unexpected-Ident Tracking

After parsing the generated source, build the expected-name set from the bundle's `title` values.
Compare against the names of all emitted top-level declarations.
Log to stderr:

- Total count of unexpected names.
- Each unexpected name and, if traceable, the bundle entry that triggered the extraction.

On the first run: this is diagnostic.
If zero or very small, our schemas are not triggering `json-schema-to-typescript`'s extraction heuristic and the contract holds in practice.
If non-trivial, we have data to decide between fork-and-disable-extraction vs re-inlining patch vs schema refactoring.

Keep this check permanently as a build-time regression guard, even if the first run is clean.

## File Assembly

For each role:

1. Sort declarations by name (case-sensitive ASCII).
2. Compute imports: the set of identifiers referenced in this file's declarations that are routed to other files (shared/ for the non-shared roles; nothing for shared/).
3. Emit:
   - Banner comment (configurable, default "Generated. Do not edit.").
   - Import statement (single line per source file, `import type { A, B, C } from '../shared/types'`), if any.
   - Blank line.
   - Concatenated declaration source slices (from the generated bundle output), separated by blank lines.

Use range-based slicing on the original generated source rather than rebuilding declarations from the AST.
Preserves whatever formatting `json-schema-to-typescript` produced.

## tsc Validation

After writing the three files, run `tsc --noEmit` with a tsconfig that includes them.
Fail the codegen if tsc reports errors.
The most likely failures are:

- Missing imports (a bug in the reference-collection logic).
- Duplicate definitions (a bug in dedup, shouldn't happen with single-bundle generation).
- Cross-role references that escaped the validation step (a bug there).

## Library-Evaluation Checklist

Behaviour to observe on the first end-to-end run against real schemas.
Each item has a decision branch: ship as-is, post-process inside the adapter, or swap the underlying library.
A failure here doesn't block the pipeline — it informs whether the current adapter implementation is good enough or needs replacement.

### Q1: Does `json-schema-to-typescript` respect our `title`-only naming contract?

**What to check**: Run the library on a bundle containing several representative schemas — `WorkspaceResourceHalSchema`, `RoomResourceSchema`, `CreateRoomSchema`, plus a few enum/dictionary cases (`ColorPaletteSchema`, `ShortNameLocalizationDictionarySchema`).
Count emitted top-level declarations vs schemas with `title`.

**Decision branches**:

- All emitted declarations have names from our `title` set → ship the simple pipeline.
- A handful of synthetic names → ship + patch step (re-inline synthetics via magic-string in a cleanup pass before classification).
- Many synthetic names → fork-and-vendor, disable extraction heuristic at source.

### Q2: How does it handle `propertyNames`-with-enum dictionaries?

**What to check**: Generate `ShortNameLocalizationDictionarySchema` and `DescriptionLocalizationDictionarySchema`.
The desired output is `Partial<Record<"en" | "es" | "ru", string>>` or an interface form (`{ en?: string; es?: string; ru?: string }`).
The undesirable output is `{ [k: string]: string }` (loses the locale-key enum entirely).

**Decision branches**:

- Generates the constrained `Record` form → no action needed.
- Generates the loose form → add a post-processing pass that detects `propertyNames`-enum dictionaries in the bundle and overrides the generated type. ~20 lines via magic-string on the generated source.

### Q3: How does it handle our enum schemas?

**What to check**: Generate `ColorPaletteSchema` (string enum with many values).
Desired output is a string-literal union type alias (`export type ColorPaletteV1_0_0 = "color_0_0" | "color_1_0" | ...`).
Undesired output is a TS `enum` declaration.

**Decision branches**:

- String-literal union → no action.
- TS `enum` → check if `enableConstEnums: false` and other config knobs flip the output. If not, post-process or fork.

### Q4: Bundling: does the hand-rolled `svc:urn`-keyed dedup produce a clean single-doc bundle?

**What to check**: Two top-level schemas that both `$ref` `urn:schema:core.ShortNameLocalizationDictionary:1.0.0`.
After bundling, the resolved bundle should have exactly one `definitions` entry for `ShortNameLocalizationDictionary`, with both reference sites rewritten to `#/definitions/ShortNameLocalizationDictionary`.

**Decision branches**:

- Bundler correctly dedupes and `json-schema-to-typescript` accepts the bundle without complaint → ship the bundler as-is.
- Bundler dedupes but j-s-t-t produces unexpected names from the `definitions` keys (see Q5) → adjust the bundler's naming of `definitions` keys to match the desired type names.
- Edge cases (circular refs, JSON Pointer escaping of unusual characters in names, multi-version dedup) → handle in the bundler with targeted fixes.

### Q5: How does `json-schema-to-typescript` map bundle `definitions` keys to TS type names?

**What to check**: With `title` present on every schema, does the library use `title` as the type name, or does it use the key under `definitions`, or something else?
The desired behavior is `title` wins.

**Decision branches**:

- Uses `title` → no action.
- Uses `definitions` key → either (a) name the `definitions` keys to match the desired type names during bundling, or (b) post-process to rename.

### Q6: What does the library do with `$id` URLs in the bundled schemas?

**What to check**: After bundling, definitions entries may retain their original `$id` URL.
Does this leak into the generated output as a JSDoc comment or other artifact?
Is it desirable or just noise?

**Decision branches**:

- Clean output → no action.
- Noise → either strip `$id` from the bundle before generation, or filter the generated output.

### Q7: How does it handle the HAL `_links` pattern with `additionalProperties` and complex link rels?

**What to check**: Generate one HAL-shaped schema (`WorkspaceResourceHalSchema`).
Does `_links` come out as a usable type?
Does it require `_links` correctly (the HAL schema declares it required)?

**Decision branches**:

- Reasonable output → no action.
- Loose/wrong output → consider whether `_links` needs its own dedicated schema with `title` so it's a proper named type, or whether a post-processing pass is needed.

### Q8: Does it handle `additionalProperties: false` correctly on objects?

**What to check**: Our schemas use this for closed-shape objects.
Library should emit interfaces with only the declared properties and no index signature.

Should be straightforward; flagging only for completeness.

## Implementation Order

Production-ready from the start; tests are the runner. The first end-to-end test against the 48 demo schemas (Phase A) reveals the library-evaluation checklist answers directly from observable output. Phase B exercises the larger `swifttt-frontend-temp` corpus once Phase A is clean.

1. **Bundle module.** Hand-rolled walker. Loads schemas in memory, deduplicates by `svc:urn`, rewrites refs to `#/definitions/<name>`. Builds the urn→role and urn→title maps.
2. **Compiler adapter.** `JsonSchemaToTsCompiler` interface + initial `json-schema-to-typescript` implementation. Adapter is the only place library-specific code lives.
3. **AST classify + validate.** Parse the compiler output with `typescript-estree`; classify each declaration by role; validate no cross-role refs between commands and reps; collect unexpected-ident metrics.
4. **Assemble + write.** Sort declarations, compute imports per file, slice + concat into three TS source strings, write to `src/cqrs/{shared,commands,reps}/types.ts`.
5. **tsc check.** Post-write `tsc --noEmit` validation.

Each step is independently testable.
If the first end-to-end run shows the compiler library produces junk on any item in the library-evaluation checklist, swap the adapter (no other pipeline changes) and re-run.

## Out of Scope

- Generating typed client methods (`client.iam.createTenant(...)`). Types-only for now; consumer wraps them with their own (or our hand-written) fetch helpers.
- Multi-version handling (Option C from earlier discussions: unversioned aliases via consumer config). Always emit versioned types per `title`; aliases come later if needed.
- Per-resource HAL link types with typed rels. Generic `HalLinks` is fine for v1.
- Branded primitive types (`RoomID`, `BigIntStr`, etc.) — these will codegen as plain `string`. Branding is a future-pass concern, possibly via a custom post-processing step or via fork.

## Success Criteria

- Three files generated: `shared/types.ts`, `commands/types.ts`, `reps/types.ts`.
- Every schema with `$id`+`title` becomes an exported type in exactly one of the three files.
- No unexpected idents (or a small, understood, accepted set).
- `tsc --noEmit` passes.
- Generated output is small enough and readable enough that humans can spot-check it during code review.
- Re-running codegen on unchanged schemas produces byte-identical output (stable sort, deterministic emission).
