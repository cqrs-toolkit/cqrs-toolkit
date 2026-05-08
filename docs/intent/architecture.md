# Architecture

cqrs-toolkit is a TypeScript monorepo using npm workspaces.
Packages are scoped under `@cqrs-toolkit/*`.

Each package is generally **client-only or server-only**, not both.
Packages that participate in the domain layer (events, aggregates) depend on `@meticoeus/ddd-es` for the shared core types.

## Repository layout

```
cqrs-toolkit/
  CLAUDE.md                 # repo-root operational guidance
  README.md                 # public consumer-facing intro (top of npm landing pages)
  package.json              # workspace root
  Makefile                  # build orchestration with cache-busting helpers
  scripts/                  # build / format / docs scripts invoked by Makefile and npm scripts
  packages/                 # workspace packages (the libraries)
    tsconfig.common.json    # shared strict TypeScript config
    tsconfig.strictness.json
    <pkg>/                  # one per package — see /docs/projects/<pkg>/_overview.md for each
      CLAUDE.md             # package-local castle pointer
      README.md             # public consumer-facing intro
      docs/api/             # generated TypeDoc reference
      src/
      tests/
      package.json
      tsconfig.json
  demos/                    # demo packages (reference implementations / e2e suites)
    base/                   # shared base for demos
    todo-demo/
    hypermedia-base/
    hypermedia-server/
    hypermedia-web/
    hypermedia-electron/
  docs/                     # the castle (this directory)
```

## Package layout conventions

Each package:

- Extends `packages/tsconfig.common.json`.
- Uses `"type": "module"` (ESM only).
- Exports via the `exports` field with `types` and `import` conditions.
- Builds with `tsc` to `dist/`.
- Generates API docs via `npm run docs` to `<pkg>/docs/api/`.

The `exports` and `imports` fields define each package's public API surface.
They are deliberate, designed surfaces — see [`/docs/patterns/package-boundaries.md`](../patterns/package-boundaries.md).

## Build dependency order

The Makefile encodes the inter-package build order:

```
realtime, schema      ─┐
                       ├─→ hypermedia          (depends on schema)
                       │
                       └─→ client              (depends on realtime)
                              ├─→ client-solid
                              ├─→ client-electron
                              ├─→ devtools
                              └─→ hypermedia-client
                                    └─→ hypermedia-cli
```

Demos compose multiple packages and sit at the leaves of the build graph.

## Castle layout

The castle (`/docs/`) is a self-contained fractal — see [`/docs/map.md`](../map.md) for the wing layout and project list.
Every project (package or demo system) has its full castle inline at `/docs/projects/<name>/`.
Code at `packages/<pkg>/` keeps only what must travel with the package: README, generated `docs/api/`, source, and a slim `CLAUDE.md` that points back to the canonical castle.
