# 0011 — Eviction Contract — Change log

Log of substantive changes to [`0011-eviction-contract.md`](0011-eviction-contract.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-07 — Refine "single-tab modes" plural + align session event names + soften §11.6.1 SharedWorker termination claim

**Reason.** Three drift threads:

1. **"Single-tab modes" plural was wrong.** The doc treated Mode A and Mode B as both single-tab. Per current architecture (see [`0001 §1.1`](0001-modes-and-constraints.md#11-supported-execution-modes)), Mode A is online-only with no tab lock — multiple tabs may run independently with their own in-memory state. Only Mode B (DedicatedWorker) has a tab lock. §11.7.3 conflated the eviction conditions ("the tab is closed (data lost with the session)" is Mode A behavior, not Mode B); §11.11 incorrectly attributed concurrent-access protection to "single-tab modes" plural.
2. **§11.10's `SessionReset` event name predated the [`0010 §10.3.1`](0010-public-api.md#1031-session-and-connectivity-events) / [`0005 §5.3.4`](0005-sync-manager.md#534-session-user-change-handling) work.** Implementation refined the user-mismatch signaling into `SessionDestroyed { reason: 'user-changed' }` followed by `SessionChanged { userId, isNew: true }`. The `reason` enum on `SessionDestroyed` is the subscription point UX layers can hook for prompts.
3. **§11.6.1 overstated SharedWorker termination frequency.** The original "may be terminated at any time while windows remain open (e.g., if all MessagePorts are garbage collected briefly)" framing implied routine restarts during normal multi-tab operation. Per browser behavior, SharedWorkers terminate when the owner-set becomes empty; transient browser-managed termination of an active worker is rare. Softened the framing without weakening the restart-resilience contract that follows.

**Changes.**

- §11.7.3 — split into §11.7.3 (Mode B specifically — tab lock release with persisted data intact) and §11.7.4 (Mode A — in-memory only, all state lost on tab close).
- §11.10 — replaced `SessionReset` event reference with the actual emission: `SessionDestroyed { reason: 'user-changed' }` at wipe start, then `SessionChanged { userId, isNew: true }` once the new session is established. Cross-references [`0010 §10.3.1`](0010-public-api.md#1031-session-and-connectivity-events) and [`0005 §5.3.4`](0005-sync-manager.md#534-session-user-change-handling).
- §11.11 — generalized the "single-tab enforcement" guarantee to attribute concurrent-access protection accurately: Mode B's tab lock at the storage layer; Mode A's in-memory per-tab isolation achieves the same property without coordination.
- §11.6.1 — refined the SharedWorker termination claim: terminates when the owner set becomes empty; browser-managed mid-life termination is rare but possible. The restart resilience contract that follows still covers both cases.
