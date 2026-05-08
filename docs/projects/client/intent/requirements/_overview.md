# CQRS Client — Library Specification

This is the requirements wing of the `@cqrs-toolkit/client` project castle.
Each numbered file specifies one component or cross-component contract of **CQRS Client**, an offline-capable CQRS/event-sourcing client data layer for web apps.
The library supports an occasionally connected model with optimistic command execution, SQLite WASM persistence (via OPFS), and an online-only in-memory mode.
The storage layer uses a tiered worker model: SharedWorker for multi-tab support, Dedicated Worker for single-tab isolation, or online-only in-memory mode as a fallback.

## Requirements

| #    | Requirement                                            | Description |
|------|--------------------------------------------------------| ----------- |
| 0001 | [Modes and Constraints](0001-modes-and-constraints.md) | Execution modes (online-only, dedicated-worker, shared-worker), mode detection and cache, session model, event persistence semantics, and cross-component invariants. |
| 0002 | [Domain Layer](0002-domain-layer.md)                   | Pure business logic for client-side command validation and anticipated event production. |
| 0003 | [Cache Manager](0003-cache-manager.md)                 | Metadata and policy for managing which data scopes are locally cached, including lifecycle events, eviction policies, and multi-tab coordination. |
| 0004 | [Command Queue](0004-command-queue.md)                 | Persisting, sequencing, retrying, and reconciling commands with support for offline capture, optimistic updates, and file uploads. |
| 0005 | [Sync Manager](0005-sync-manager.md)                   | Network-facing orchestration for keeping local data up to date via REST and WebSocket, including connectivity management and gap repair. |
| 0006 | [Event Cache](0006-event-cache.md)                     | Temporary bounded store for buffering out-of-order events and storing anticipated events pending reconciliation. |
| 0007 | [Read Model Store](0007-read-model-store.md)           | Authoritative queryable state combining server snapshots, permanent events, and optimistic overlays. |
| 0008 | [Event Processors](0008-event-processors.md)           | Per-collection reducers that transform events and snapshots into read model records. |
| 0009 | [Query Manager](0009-query-manager.md)                 | Read-only public interface for querying effective state from the Read Model Store. |
| 0010 | [Public API](0010-public-api.md)                       | Event system design, public module surface, and worker/window communication boundaries. |
| 0011 | [Eviction Contract](0011-eviction-contract.md)         | Cross-component rules for cache key lifecycle, window holds, heartbeat liveness, and worker restart resilience. |
| 0012 | [Aggregations](0012-aggregations.md)                   | Locally-computed derived values (counts, sums) via live SQL queries or optional pre-computed incremental updates. |
| 0013 | [DevTools](0013-devtools.md)                           | Chrome extension plan for inspecting commands, events, cache, read models, sync, and storage. |
| 0014 | [EntityRef](0014-entity-ref.md)                        | Client-side entity lifecycle tracking via `EntityRef` — making pending temp IDs visible in read model data for automatic cache key and dependency wiring. |
| 0015 | [Aggregate Config](0015-aggregate-config.md)           | First-class aggregate configuration — decouples stream ownership from collections and enables explicit ID reconciliation. |

## Conventions

- Each requirement is a numbered file (`NNNN-slug.md`) using 1-indexed four-digit zero-padded numbers.
- Numbers are never reused; superseded requirements keep their number forever (with a back-pointer to the superseding entry).
- Substantive changes to a requirement get logged in a paired `NNNN-slug-log.md` file.
  Log files are created lazily — at the first substantive change, not preemptively at file creation.
- Wing-level structural events (adding a brand-new requirement, bulk renumbering, this migration) go in [`../../evolution/_overview.md`](../../evolution/_overview.md), not in any individual log.
- Drift between requirements and code is corrected by editing the requirement, recording the change in its log, and writing an ADR in [`../../decisions/`](../../decisions/) explaining the why.

## Referenced from

- [`/docs/projects/client/_overview.md`](../../_overview.md) — the project castle's entrance hall points here as the spec.
- [`/docs/projects/client/evolution/_overview.md`](../../evolution/_overview.md) — records the migration that produced this wing (2026-05-04).
- [`/docs/evolution/_overview.md`](../../../../evolution/_overview.md) — the repo-level castle-adoption changelog references this wing as the destination of the Phase 4 migration.
