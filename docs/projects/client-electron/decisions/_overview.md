# decisions/ (client-electron)

ADRs scoped to `@cqrs-toolkit/client-electron`.
Repo-wide decisions live in [`/docs/decisions/_overview.md`](../../../decisions/_overview.md).
Decisions about the underlying client surface live in [`/docs/projects/client/decisions/_overview.md`](../../client/decisions/_overview.md).

## Decisions

- [ADR 0001 — Utility-process worker topology, native better-sqlite3, per-environment bootstrap](0001-utility-process-worker-bootstrap.md) — four-entry-point setup (main / preload / utility-process worker / renderer); reuses the browser worker proxy machinery; `BetterSqliteDb` as the environment `ISqliteDb` implementation.
