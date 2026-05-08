# 0003 — Cache Manager — Change log

Log of substantive changes to [`0003-cache-manager.md`](0003-cache-manager.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-07 — Reconcile §3.2 / §3.3 / §3.5 / §3.12 with current cache key design

**Reason.** The cache key design has evolved since the doc was first written, and [`0014 §14.5.5`](0014-entity-ref.md#1455-cache-key-derivation) layered EntityRef-driven reconciliation on top. Four drift threads needed to be addressed together:

1. **Pre-open-source residue.** §3.2.1 listed `type ∈ { Tenant, Workspace, Project, Room }` — a hardcoded enum from a specific application context that predates the library being a standalone project. `type` and `service` values are app-specific (consumer-defined per `TLink`); the library is opaque to them.
2. **Cache key model redesign.** Entity keys are now Link-based (`link: TLink` with `{ type, id }` or `{ service, type, id }` for `ServiceLink`); `service` on entity keys is conditional on `TLink` shape, not a top-level field. Cache key UUIDs are opaque and assigned by `registerCacheKey` rather than always derived as UUID v5 (`deriveScopeKey` UUID v5 derivation is retained for scope keys without `EntityRef` values).
3. **EntityRef auto-reconciliation ([`0014 §14.5.5`](0014-entity-ref.md#1455-cache-key-derivation)).** Identity inputs may carry `EntityRef` values; `registerCacheKey` extracts them, records `pendingIdMappings`, and auto-reconciles when the producing command completes. A new `CacheKeyReconciled` event surfaces the transition; an optional `resolveCacheKey` callback on the command handler registration is the consumer escape hatch when default field-replacement reconciliation is insufficient.
4. **Event naming and additions.** The doc lists conceptual TypeScript event-type names in PascalCase; the runtime keys are kebab-case under the `cache:` namespace. Two events were missing entirely (`CacheKeyReconciled`, `CacheSeedSettled`), and the doc previously implied a single shared payload shape across all eviction events when only one eviction event exists.

The persisted schema in §3.3 had drifted from the code's columns: missing `expiresAt`, `holdCount`, `pendingIdMappings`; using non-existent `type?` / `entityId?` / `scopeParamsHash?` instead of the code's `linkType` / `linkId` / `scopeParams`.

All claims in the new §3.2.4 were verified against `packages/client/src/core/cache-manager/CacheManager.ts` (`scanTemplateForEntityRefs`, `PendingIdMapping`, `resolvePendingKeys`, `resolveCacheKey` callback wiring) and `packages/client/src/types/events.ts` (`cache:key-reconciled`).

**Changes.**

- §3.2.1 — rewrote entity / scope sections in Link-based terms. Dropped the `{ Tenant, Workspace, Project, Room }` enum. Noted that cache key UUIDs are opaque (assigned by `registerCacheKey`) with `deriveScopeKey` UUID v5 derivation as a fallback for scope keys without `EntityRef` values.
- §3.2.3 — added the persisted `holdCount` field as the at-rest mirror of the in-memory `activeWindowIds`.
- §3.2.4 — added a full "EntityRef-driven inputs and reconciliation" subsection covering the `registerCacheKey` extraction → `pendingIdMappings` → auto-reconciliation flow, citing [`0014 §14.5.5`](0014-entity-ref.md#1455-cache-key-derivation) and [`§14.5.2.1`](0014-entity-ref.md#14521-entity-ref-path-expressions) (path expressions). Notes the `CacheKeyReconciled` event and the optional `resolveCacheKey` callback as a consumer escape hatch for complex cases.
- §3.3 — rewrote the persisted schema to match the code: split entity-only / scope-only / common column groups; replaced `type?` / `entityId?` / `scopeParamsHash?` with `linkService` / `linkType` / `linkId` / `scopeParams`; added `expiresAt`, `holdCount`, `pendingIdMappings`.
- §3.5 — added new §3.5.1 "Register" describing `registerCacheKey` as the primary creation API for EntityRef-aware cache keys; renumbered existing Touch/Hold/Release to §3.5.2/.3/.4; updated Touch language to acknowledge the dual creation paths (auto-create on touch is the `deriveScopeKey` UUID v5 path; EntityRef-bearing identities must use `registerCacheKey`).
- §3.12 — added the missing TypeScript event types `CacheKeyReconciled` (EntityRef reconciliation) and `CacheSeedSettled`. Added a note clarifying the convention — event names listed are conceptual TypeScript event types; runtime keys are kebab-case under the `cache:` namespace and map mechanically except for `CacheKeyEvicted` ↔ `cache:evicted` (no `key-` infix). Dropped the dead "all eviction events use the same payload shape" line — only one eviction event exists.
