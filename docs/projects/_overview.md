# projects/

Nested project castles, recursively.
Each entry is a project — a package, a demo system, or a sub-project of either — with its full castle inline.

## Convention

- Every project is a directory (e.g. `client/`), never a flat file.
- Every project has at least an `_overview.md` (the registry-style entry point).
- A project's castle wings — `intent/`, `explorations/`, `decisions/`, `evolution/`, `patterns/`, `playbooks/`, `mindset/` — are added inline as content emerges.
  Empty wings are not created up front.
- Projects can nest further via their own `projects/` sub-wing (e.g. `demo/projects/todo/`).

## All castles are inline

There is no co-located canonical castle elsewhere.
Substantive content for project `<name>` lives at `docs/projects/<name>/` — never duplicated under `packages/<name>/docs/`.
The package directory keeps only its public README, generated `docs/api/`, source, and a slim `CLAUDE.md` that points back here.

## `_overview.md` files at every level

Every project root has an `_overview.md`.
Every wing (`decisions/`, `patterns/`, `playbooks/`, `mindset/`, `explorations/`, `evolution/`, `intent/requirements/`, `intent/`, project sub-wings under `projects/`) gets its own `_overview.md` once it holds a first meaningful entry.
Empty wings get nothing — the wing `_overview.md` is created lazily, at the same moment the wing's first real content lands.

A wing with a single entry still gets an `_overview.md` for consistency.
The trade-off — one file of arguable redundancy — is paid in exchange for a uniform pattern: an agent walking into any wing sees the same shape (a header file with the index plus context) and never has to remember exceptions.

**Principle (applies at every level)**: enumerate with context, or not at all.
Filenames don't satisfy the link-discipline rule — a reader should be able to decide whether to follow a link from the link text alone, without opening the target.
So when an overview surfaces contents, it does so as a list of *every* entry with a one-line hook drawn from the entry's title or purpose, not as "see `decisions/`" or "run `ls decisions/`".
Items that don't need per-instance context (standard monorepo paths like `src/` and `test/`) shouldn't be enumerated at all — agents read the tree directly.

## Project `_overview.md` shape

The project root `_overview.md` is the room's entrance hall.
Recommended fields:

- **Status**: Active / Mature / Deprecated
- **Castle**: link to this directory (or in the case of a project that nests further, links to sub-projects)
- **Public API**: stable / experimental / internal-only / not published / N/A (for projects that expose no API surface, like demos)
- **Depends on (within repo)**: other projects this project's source imports from directly.
- **Depended on by (within repo)**: other projects whose source imports from this project directly.

*Counting rule for both dependency fields.* Both lists are populated by **direct source-level imports**.
A project belongs in a list only when one project's source code imports an artifact from the other.
Transitive dependencies — what your dependencies internally depend on — are impl details of those dependencies and don't go here; they belong in the deps' own overviews.

If a source import exists without a matching declaration in the importing project's `package.json` (under `dependencies`, `devDependencies`, or `peerDependencies` as the import context warrants), the `package.json` is the wrong half of the mismatch — fix it (`npm i -D -w <project>` or the equivalent; see the repo-root `CLAUDE.md`'s npm-i guidance) and include the project in the list.
Don't omit a real depender to match an out-of-sync declaration.
- **Purpose**: one paragraph on what this project does and why it exists
- **Current state**: one paragraph on what currently exists in the codebase. Strictly descriptive of present reality — not in-progress work, not planned work. Forward-looking "X should work like Y" content (whether or not X exists yet) belongs in the project's `intent/requirements/` wing.
- **Always Read entries** *(optional)*: a hand-picked set of wing entries (ADRs, mindset framings, patterns) every contributor to this project should know about regardless of task. Each bullet links to the entry with a one-line *why-this-one*. Cap is roughly three; adding a fourth means demoting the weakest one back to wing-only. Omit the section entirely if nothing qualifies.
- **Wings**: a short list of bullets pointing to each populated wing's `_overview.md` (e.g. `decisions/_overview.md`, `patterns/_overview.md`, `intent/requirements/_overview.md`). The wing overviews carry the per-entry enumeration; this list is the navigation hub. Omit wings that don't yet have content.
- **Where things live** *(only for non-obvious locations)*: external dashboards, runbooks in other repos, deployed services, integration/e2e test directories that live outside the package, asset directories outside `src/`. Standard monorepo paths (`src/`, `test/`, etc.) don't belong here — agents derive those from `ls`.

The project `_overview.md` does **not** enumerate ADRs, requirements, patterns, or other wing contents directly.
That enumeration lives in each wing's own `_overview.md`.
The `Always Read entries` section is the only place where individual wing entries surface at the project level — and only for genuinely load-bearing items.

## Wing `_overview.md` shape

A wing `_overview.md` is the canonical index for that wing's entries.
It carries:

- **The index**: bullets linking to every entry the wing holds, each with a one-line hook from the entry's title or context. Mark superseded items inline (e.g., `— superseded by ADR 0007`) so a reader scanning can route past them without opening the file.
- **Wing-relevant context** *(optional)*: any text that belongs to the wing as a whole rather than to a single entry — purpose, conventions specific to this wing, cross-cutting notes. Castle-wide conventions (date everything, append-only, ADR immutability) live in [`map.md`](../map.md) and don't repeat here.

Wings whose canonical content *is* a single chronological document — `evolution/_overview.md` is the changelog; `intent/glossary.md` is the glossary — fold the index and the content into one file. The file is labeled internally for what it is (`# Repo changelog`, `# Glossary`); the filename is `_overview.md` for consistency with the wing-index pattern.

## Status and Public API are independent axes

- *Status* tracks the **lifecycle** — is the project still receiving ongoing work?
- *Public API* tracks the **stability contract** — what guarantees does the public surface offer consumers?

A project can be `Active` and `experimental` (typical pre-release), `Active` and `stable` (mature library still being maintained), `Mature` and `stable` (low-maintenance reliable), `Deprecated` and `not published` (retired).
Both fields belong on every project `_overview.md`; don't conflate them by writing things like `Active (pre-release)` in the Status field — pre-release is a stability axis statement, not a lifecycle one.
The repo's pre-release posture lives globally in [`/docs/decisions/0001-pre-release-no-back-compat.md`](../decisions/0001-pre-release-no-back-compat.md); per-project `_overview.md` files should not restate it.
