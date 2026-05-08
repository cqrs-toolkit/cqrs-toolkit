# Repo changelog

Append-only history of cross-cutting / multi-package changes.
Per-project changes are recorded in each project's own `evolution/_overview.md` (e.g., [`projects/client/evolution/_overview.md`](../projects/client/evolution/_overview.md)).
This file holds only changes that span packages or affect the repo as a unified artifact.

## 2026-05-04 — Castle adoption (memory-palace migration)

The repo adopted a "memory palace" structured documentation tree rooted at [`docs/`](../).
Three layers:

- **Repo-level castle** at [`docs/`](../) for cross-cutting content — wings `intent/`, `decisions/`, `evolution/`, `patterns/`, `playbooks/`, `mindset/`, `projects/`.
- **Self-contained fractal**: every project (package or demo system) has its full castle inline at [`docs/projects/<name>/`](../projects/_overview.md), not co-located with code.
  Code at `packages/<pkg>/` keeps only its npm-shipped README, generated `docs/api/`, source, and a slim `CLAUDE.md` that points to the canonical castle.
  One doc-tree mental model; no cross-tree link tax.
- **Personal meta-castle** at `~/palace/` (out-of-repo) holding cross-project patterns and playbooks.

### Spec drift

The migrated requirements files were not edited at migration time.
Drift between the requirements and current code is corrected as work touches each requirement: edit the requirement, write a paired `-log.md` entry, write an ADR in [`projects/client/decisions/`](../projects/client/decisions/_overview.md). The three writes are a unit.

## 2026-05-05 — First playbook: adding-a-new-package

Wrote [`playbooks/adding-a-new-package.md`](../playbooks/adding-a-new-package.md), the first entry in the playbooks wing.

Extracted from the patterns established by the nine existing packages (`client`, `client-electron`, `client-solid`, `devtools`, `hypermedia`, `hypermedia-cli`, `hypermedia-client`, `realtime`, `schema`).
Captures: package directory shape, `package.json` template, dual TS configs (`tsconfig.json` + `tsconfig.build.json`), TypeDoc + Vite config, LICENSE, README conventions, package CLAUDE.md castle pointer, Makefile entries, castle setup (`docs/projects/<name>/_overview.md`), repo-level updates (`map.md` projects table, repo-root CLAUDE.md packages list), and rollback procedure.

The playbook is TypeScript-centric per the monorepo's expected scope.
A new language toolchain (e.g., Rust via Tauri) would need separate evaluation before this playbook applies.

Pre-publish setup (`repository`/`homepage`/`bugs` fields, `publishConfig: { access: public }`) is intentionally not part of this playbook — those belong in a future publishing playbook to be written when the publish flow is exercised through the castle for the first time.
