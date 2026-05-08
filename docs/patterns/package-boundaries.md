# Package boundaries

The `exports` and `imports` fields in each package's `package.json` define its public API surface.
They control how TypeScript resolves cross-package imports and what consumers can import from each package.

## Convention

Treat the `exports` and `imports` fields as deliberate, designed surfaces.
They are not generated; each entry was added on purpose.

When asked to add a new feature or change an internal API, do not add, remove, or modify `exports` or `imports` fields without explicit instruction.
A new export means expanding the public API; a new import means restructuring how the package consumes its dependencies.
Both are design decisions, not implementation details.

If a feature seems to require a new entry in `exports` or `imports`, surface that as a question rather than adding it directly.

## Build-tooling implications

In packages that build to `dist/`, `imports` field values use `.js` extensions, not `.ts`.
See [`code-style.md`](code-style.md) for the runtime resolution rationale.

## `dependencies` declarations match source imports

Every workspace package's source-level import (`from '@cqrs-toolkit/<pkg>'` or any other declared workspace dep) must have a matching declaration in the importing package's `package.json` — under `dependencies`, `devDependencies`, or `peerDependencies` as the import context warrants.

The source import is the source of truth.
When you find an import without a matching declaration, the declaration is what's wrong: fix it via `npm i ...` (see the repo-root `CLAUDE.md`'s npm-i guidance), don't hand-edit version strings.
Symmetrically, a declaration with no source import anywhere in the package is dead and should be removed.

This rule is what underlies the `Depends on` / `Depended on by` shape rule in [`/docs/projects/_overview.md`](../projects/_overview.md): a project is counted as a depender by direct source imports, not by `package.json` declaration state — but where source and declaration disagree, the declaration is the side that gets fixed.

## Release version sync within related package families

Some package families converge their published minor versions (major once 1.0+) at release time so that matching halves of a release are obvious at a glance.

The **hypermedia trio** — `@cqrs-toolkit/hypermedia`, `@cqrs-toolkit/hypermedia-client`, `@cqrs-toolkit/hypermedia-cli` — follows this rule:

- A release from any one package does *not* force a co-release of the others; release pressure stays per-package, and each package's own version trajectory is independent.
- When any trio member next has a meaningful release, its new minor catches up to the highest current minor across the trio. (Example: `hypermedia` went 0.1.x → 0.2.x → 0.3.0 over its own release cycles; `hypermedia-client` and `hypermedia-cli` had no meaningful releases over that span and were still at 0.1.0, so their next releases jumped straight to 0.3.0 — the 0.2.x minor never appeared in their version history.)

Peer-dep ranges encode the trio's coupling tiers:

- `hypermedia` ↔ `hypermedia-client` use tight ranges (`^X.Y.0`), since they co-evolve API-surface contracts and breakage should surface in npm's resolver early.
- `hypermedia-cli` peers against either with a looser range (`>=X.Y.0`), since its work at the apidoc-JSON-LD layer is meant to outlive minor churn in the type-import layer.

`npm i --save-peer` lands `^X.Y.Z` by default, which fits the tight tier but not the loose tier. Adjust by hand only when the *constraint shape itself* needs to encode the decoupling.

## Where applied

Repo-wide.
Every workspace package owns its `package.json` and its public surface.
