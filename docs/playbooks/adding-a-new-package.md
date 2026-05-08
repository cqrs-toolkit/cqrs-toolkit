# Adding a new package

End-to-end procedure for creating a new TypeScript workspace package under `packages/<name>/`.
Extracted from the patterns established by the nine existing packages in the monorepo.

## Purpose

Add a new TypeScript package to the monorepo such that it builds, tests, generates docs, and integrates with the castle without manual ad-hoc setup.

## Trigger

You've decided that a new piece of functionality belongs as its own published `@cqrs-toolkit/<name>` package — typically because it has a coherent public API surface, a distinct dependency profile, or a separate lifecycle from existing packages.

If you're not sure whether the new code is a package or just a module in an existing package, ask first.
The threshold for "deserves its own package" is "consumers should be able to depend on it independently."

## Scope and language

This playbook is TypeScript-centric.
The cqrs-toolkit monorepo is not expected to grow multi-language; if a new package introduces a non-TS language toolchain (e.g., a Tauri demo bringing Rust), evaluate the publishing, build, and tooling implications separately and update this playbook (or write a new one) before proceeding.

## Prerequisites

- The new package's name is decided: `@cqrs-toolkit/<name>` (kebab-case, no abbreviations unless they match an existing convention).
- You know the new package's dependencies on existing in-repo packages.
- You know whether the package will be publishable to npm (most are) or workspace-internal (e.g., shared demo bases like `demos/base`).
- You're working from a clean git state — uncommitted work in unrelated files makes diff review harder.

## Steps

### 1. Decide kind and location

| Kind | Location | Examples |
|---|---|---|
| Publishable library package | `packages/<name>/` | `client`, `hypermedia`, `realtime`, `schema` |
| Internal demo composing-package | `demos/<name>/` | `demos/todo-demo`, `demos/hypermedia-server` |
| Internal demo shared-base (not a logical demo on its own) | `demos/<name>/` | `demos/base`, `demos/hypermedia-base` |

The rest of this playbook assumes a publishable library package under `packages/<name>/`.
Demo packages follow the same patterns minus the LICENSE / README-as-consumer-doc / docs/api/ generation; see [`/docs/projects/demo/_overview.md`](../projects/demo/_overview.md) "What belongs here" for demo-specific guidance.

### 2. Create the directory structure

```bash
mkdir -p packages/<name>/src
```

Tests live beside source files (per [`/docs/patterns/testing.md`](../patterns/testing.md)) — there's no separate `tests/` directory.

### 3. Create `package.json`

Follow the template established by existing packages (e.g., `packages/realtime/package.json` for a simple package, `packages/client/package.json` for one with sub-path exports and an internal alias).

Required fields:

```json
{
  "name": "@cqrs-toolkit/<name>",
  "version": "0.1.0",
  "description": "<one-sentence purpose>",
  "keywords": ["cqrs", "event-sourcing", "..."],
  "license": "MIT",
  "author": "Ontel, LLC",
  "main": "dist/src/index.js",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/src/index.d.ts",
      "import": "./dist/src/index.js"
    }
  },
  "files": ["dist", "LICENSE", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.build.json",
    "compile": "tsc -p tsconfig.json --noEmit",
    "docs": "typedoc",
    "test": "vitest"
  }
}
```

Notes:

- **Initial version is `0.1.0`** for all packages, per the pre-release posture ([ADR 0001](../decisions/0001-pre-release-no-back-compat.md)).
- **`main` and `exports` paths use `dist/src/...`** because the build emits the `src/` tree as-is into `dist/`.
- **Add sub-path exports** (`./internals`, `./testing`, `./fixtures`, `./utils`, etc.) only when there's a real reason for consumers to import from them separately.
  Don't add speculative sub-paths.
  Modifying `exports` later requires explicit instruction — see [`/docs/patterns/package-boundaries.md`](../patterns/package-boundaries.md).
- **`imports` field for internal aliases** (e.g., `#utils`): use `.js` extensions in the value (`./src/utils/index.js`), not `.ts` — TypeScript resolves `.js` → `.ts` at compile time, but Node resolves `.js` to the actual built file in `dist/`.
  See [`/docs/patterns/code-style.md`](../patterns/code-style.md) "Package imports use `.js` extensions."
- **`dependencies` / `peerDependencies` / `devDependencies`** — add via `npm i <pkg> -w packages/<name>` (or `-D` / no flag for prod), never by hand-editing.
  See [`/CLAUDE.md`](../../CLAUDE.md) "Use `npm i` for dependencies."
- **Pre-publish-only fields** (`repository`, `homepage`, `bugs`, `publishConfig: { access: public }`) are added in the publishing flow, not at package creation.
  Adding them now is fine but not required.

### 4. Create the TypeScript configs

Two configs per the existing pattern: `tsconfig.json` for type-checking and `tsconfig.build.json` for emitting.

`tsconfig.json`:

```json
{
  "extends": "../tsconfig.common.json",
  "compilerOptions": {
    "types": ["vitest/importMeta"],
    "baseUrl": ".",
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["package.json", "src/index.ts", "src/**/*.ts"]
}
```

`tsconfig.build.json` typically extends `tsconfig.json` and excludes test files; copy from `packages/realtime/tsconfig.build.json` as the reference.

If the package needs strict-mode tightening beyond the common defaults, use `packages/tsconfig.strictness.json` as a reference.

### 5. Create `typedoc.json` and `vite.config.ts`

Copy `typedoc.json` and `vite.config.ts` from `packages/realtime/` and adjust paths to match the new package.

The `typedoc.json` controls the generated API docs that land in `<name>/docs/api/`.
The `vite.config.ts` is used by Vitest for test runs.

### 6. Add `LICENSE`

Copy `packages/realtime/LICENSE` (MIT, Ontel LLC, 2026-present).
Each publishable package ships its own LICENSE file in the npm tarball — that's why it's in the `files` array of `package.json`.

### 7. Write `README.md`

Public consumer-facing intro.
Models to follow:

- Short package: `packages/realtime/README.md`.
- Larger package with multiple entry points: `packages/hypermedia/README.md`.

Standard sections: install, quick-start, key concepts / entry points, API reference link to `docs/api/`, license.

This README ships with the published npm package — write it for an external consumer who has never seen the monorepo.

### 8. Add the package's `CLAUDE.md` castle pointer

```bash
# Copy the template from any existing package
cp packages/realtime/CLAUDE.md packages/<name>/CLAUDE.md
```

Then edit:

- The path in the heading (`# packages/<name>/`).
- The link target (`/docs/projects/<name>/_overview.md`).

The role of this file: discoverability hop from the code tree to the canonical castle.
A fresh agent reading code in `packages/<name>/src/...` finds this `CLAUDE.md`, follows its link to `docs/projects/<name>/_overview.md`, and is now in the project's castle.
The repo-root `CLAUDE.md` carries cross-cutting orientation; this one carries the package-local pointer plus any package-specific operational specifics that diverge from repo defaults (none for most packages).

### 9. Add the package to the Makefile

Add a `build-<name>` target near the existing build targets, declaring its in-repo dependencies via the `$(CACHE) packages/<name> <dep1> <dep2> --` prefix.
Add a corresponding entry to the `build:` aggregate target if the package builds during the standard build flow.

If publishable, add a `docs-<name>` target near the existing docs targets.
Add it to the parallel docs job in the `docs:` aggregate target.

Reference: existing Makefile entries for `build-realtime`, `docs-realtime`.

### 10. Wire up the workspace

Run from repo root:

```bash
npm install
```

This picks up the new directory via the existing `packages/*` workspace glob in the root `package.json` and resolves any in-repo dependencies declared in step 3.

### 11. Add the project castle entry

Create `docs/projects/<name>/_overview.md` from the registry-template shape.
Reference: any existing `docs/projects/*/_overview.md` (e.g., [`docs/projects/realtime/_overview.md`](../projects/realtime/_overview.md) for a small package, [`docs/projects/client/_overview.md`](../projects/client/_overview.md) for one with full wings).

Required fields per [`/docs/projects/_overview.md`](../projects/_overview.md):

- Status, Castle, Public API state.
- Depends on (within repo), Depended on by (within repo).
- Purpose (one paragraph), Current state (one paragraph).
- Where things live: only non-obvious locations (integration / e2e test directories outside the package, asset paths outside `src/`, dashboards, runbooks). Standard monorepo paths (`src/`, `test/`, README.md, CLAUDE.md) don't go here — agents derive those from the tree.

Optional sections, omit unless they apply:

- **Always Read entries** (cap ~3) — wing entries every contributor must know about regardless of task; surface load-bearing ADRs / mindset framings here once they exist.
- **Wings** — pointers to populated wing `_overview.md` files (`decisions/_overview.md`, `intent/requirements/_overview.md`, etc.). Omit until at least one wing has a meaningful entry; pre-created empty wings are anti-pattern.

Castle wings (`intent/`, `decisions/`, `evolution/`, `patterns/`, `mindset/`) and their `_overview.md` indexes are *not* pre-created; they grow lazily when there's content to put in them.

### 12. Update repo-level files

- Add a row to the projects table in [`/docs/map.md`](../map.md).
- Add a bullet to the packages list in the repo-root [`/CLAUDE.md`](../../CLAUDE.md) "Read this first" section.
- Update each existing project's `_overview.md` whose "Depended on by (within repo)" or "Depends on (within repo)" needs to mention the new package.

### 13. Append to repo evolution changelog

Add an entry to [`/docs/evolution/_overview.md`](../evolution/_overview.md) describing the new package, its purpose, and any cross-package effects (new dependency relationships, new build dependencies).

This is a structural change to the repo and warrants an entry per the maintenance habits.

## Verification

```bash
# Type-check and build the new package
npm run build -w @cqrs-toolkit/<name>

# Run its tests (none exist yet, but the harness should be wired)
npm run test:run -- packages/<name>/

# Verify generated API docs render
npm run docs -w @cqrs-toolkit/<name>

# Confirm castle links resolve
npm run docs:audit
```

Then format any new files (`git add` them first so the changed-files filter picks them up):

```bash
git add packages/<name>/ docs/projects/<name>/
npm run format
```

Then run the full task-completion checklist from [`/CLAUDE.md`](../../CLAUDE.md):

```bash
npm run build
npm run test:run
```

## Pre-publish setup (separate event)

Actual `npm publish` is a separate flow.
Before first publish of the new package, you'll need to add to its `package.json`:

- `repository`, `homepage`, `bugs` fields.
- `publishConfig: { access: public }` (required for first publish of a scoped package).

These are tracked separately from package creation; they don't need to exist for the package to build, test, or be developed against in the workspace.

A publishing playbook will eventually live in this directory; until then the publishing checklist material is in `publishing-checklist.md` at the repo root (locally excluded — pending archeological pass into a proper playbook).

## Rollback

If the package was created in error, removing it cleanly requires:

1. Delete `packages/<name>/`.
2. Remove the Makefile entries (`build-<name>`, `docs-<name>` if added, the references in `build:` and `docs:` aggregates).
3. Delete `docs/projects/<name>/`.
4. Remove the row from the `docs/map.md` projects table.
5. Remove the bullet from the repo-root `CLAUDE.md` packages list.
6. Revert any `Depends on / Depended on by` edits to other projects' `_overview.md` files.
7. Run `npm install` to update the lockfile.
8. Append a deprecation entry to `docs/evolution/deprecations.md` (create the file if it doesn't exist) noting the date, why the package was created, and why it was removed.
9. Run `npm run docs:audit` to confirm no broken links.
10. Run `npm run build && npm run test:run`.

Don't silently delete the package — capture why it was attempted and why it failed in the deprecations entry.
That's institutional knowledge that prevents the same misadventure on the next round.
