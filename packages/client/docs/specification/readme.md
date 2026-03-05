# CQRS Client — Library Specification

This document specifies the components of **CQRS Client**, an offline-capable CQRS/event-sourcing client data layer for web apps.
It supports an occasionally connected model with optimistic command execution, SQLite WASM persistence (via OPFS), and an online-only in-memory mode.
The storage layer uses a tiered worker model: SharedWorker for multi-tab support, Dedicated Worker for single-tab isolation, or online-only in-memory mode as a fallback.

## Sections

| #   | Section                                                    | Description                                                                                                                                                           |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | [Modes and Constraints](sections/modes_and_constraints.md) | Execution modes (online-only, dedicated-worker, shared-worker), mode detection and cache, session model, event persistence semantics, and cross-component invariants. |
| 1   | [Domain Layer](sections/domain_layer.md)                   | Pure business logic for client-side command validation and anticipated event production.                                                                              |
| 2   | [Cache Manager](sections/cache_manager.md)                 | Metadata and policy for managing which data scopes are locally cached, including lifecycle events, eviction policies, and multi-tab coordination.                     |
| 3   | [Command Queue](sections/command_queue.md)                 | Persisting, sequencing, retrying, and reconciling commands with support for offline capture, optimistic updates, and file uploads.                                    |
| 4   | [Sync Manager](sections/sync_manager.md)                   | Network-facing orchestration for keeping local data up to date via REST and WebSocket, including connectivity management and gap repair.                              |
| 5   | [Event Cache](sections/event_cache.md)                     | Temporary bounded store for buffering out-of-order events and storing anticipated events pending reconciliation.                                                      |
| 6   | [Read Model Store](sections/read_model_store.md)           | Authoritative queryable state combining server snapshots, permanent events, and optimistic overlays.                                                                  |
| 7   | [Event Processors](sections/event_processors.md)           | Per-collection reducers that transform events and snapshots into read model records.                                                                                  |
| 8   | [Query Manager](sections/query_manager.md)                 | Read-only public interface for querying effective state from the Read Model Store.                                                                                    |
| 9   | [Public API](sections/public_api.md)                       | Event system design, public module surface, and worker/window communication boundaries.                                                                               |
| 10  | [Eviction Contract](sections/eviction_contract.md)         | Cross-component rules for cache key lifecycle, window holds, heartbeat liveness, and worker restart resilience.                                                       |
| 11  | [Open Ambiguities](sections/open_ambiguities.md)           | Deferred decisions and items dependent on server-side capabilities.                                                                                                   |
| 12  | [Aggregations](sections/aggregations.md)                   | Locally-computed derived values (counts, sums) via live SQL queries or optional pre-computed incremental updates.                                                     |
| 13  | [Exploration Notes](sections/exploration_notes.md)         | Design alternatives under evaluation, including active tab handoff for non-SharedWorker contexts.                                                                     |
