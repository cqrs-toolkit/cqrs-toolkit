# 0013 — DevTools — Change log

Log of substantive changes to [`0013-devtools.md`](0013-devtools.md).
Newest entries at the top; dates in ISO `YYYY-MM-DD`.

---

## 2026-05-07 — Refine §13.1.3 event names + §13.5.4 field references

**Reason.** Two refinements:

1. **§13.1.3 listed 10 `debug:*` events as new additions to `LibraryEventType`.** Implementation refined this — the events landed under their natural namespaces (`sync:*`, `command:*`, `cache:*`) rather than under a separate `debug:` prefix, and they're always emitted rather than gated on `debug: true`. The `debug` config flag now gates only the DevTools registration on `window.__CQRS_TOOLKIT_DEVTOOLS__` and the worker debug RPC methods (§13.1.4) — the underlying events flow through `adapter.events$` regardless. The reverse-key mapping the devtools needs (UUID → collection + params) is enabled by `cache:key-added` carrying `CacheKeyIdentity` in its payload, so a separate `debug:cache-key-acquired` event isn't required.
2. **§13.5.4 referenced `server_data` / `effective_data` (snake_case).** The TS field names on `ReadModelRecord` are `serverData` / `effectiveData` (camelCase); snake_case `_server_data` / `_effective_data` are SQL-column-level names with the library-private underscore prefix. The Read Models tab renders TS field values, so camelCase is correct.

**Changes.**

- §13.1.3 — renamed section "Debug Events to Close the Gap" → "Events for DevTools Coverage". Replaced the 10-row `debug:*` event table with the actual landed event names (mostly `sync:*` and `command:*`). Removed the "only emitted when `debug: true`" framing — events are always emitted; `debug` gates only the DevTools registration. Cross-references [`0004 §4.12`](0004-command-queue.md#412-events) for command event payloads. Notes that `cache:key-added` carries `CacheKeyIdentity` directly, providing the reverse-key mapping without a separate event.
- §13.5.4 — `server_data` / `effective_data` → `serverData` / `effectiveData` (TS field names per [`0007 §7.3`](0007-read-model-store.md#73-data-model-requirements)).
