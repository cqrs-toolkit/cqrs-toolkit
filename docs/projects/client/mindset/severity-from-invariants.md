# Severity from invariants, not from UI symptoms

When assessing the severity of a bug in `@cqrs-toolkit/client`, reason from internal invariants and data consistency, not from what the user sees in the UI.

## The class of problems this applies to

Bugs involving the client's async storage layers — anywhere multiple identities, references, overlays, or pending states could interleave.
Specifically:

- Aggregate chains, EventCache, ReadModelStore, anticipated-updates map, cache-key registry, command queue.
- Operations that span multiple SQL writes against shared SQLite storage (whether OPFS-backed or via a worker).
- Anywhere the server can return a different identity for the same logical entity (e.g., temp ID → server ID reconciliation).

## The framing

A bug whose visible symptom is "brief flicker" or "wrong text appears for a moment" or "list temporarily contains a duplicate" *looks* cosmetic.
That visual surface is misleading.

The CQRS client has async operations against shared SQLite storage with multiple stores that all have to agree (commands, anticipated events, read models, aggregate chains, cache keys).
When two identities exist for the same entity across these stores — even transiently — the resulting race conditions can corrupt local data irreversibly:

- Orphaned cache-key entries that no live window holds.
- Lost optimistic overlays because a `set + isServerUpdate: true` write blew away pending local changes.
- Conflicting state where two commands wrote against different identity assumptions.
- Read models that diverge from the event stream they were supposed to derive from.

These are not "the user sees something weird for half a second."
These are "the local copy of the data is now wrong, and there's no path back to consistency without wiping it."

## How to apply

When analysing a bug's impact:

1. **Trace the full async lifecycle through every storage layer.**
   Don't stop at the first store the bug appears in.
   Aggregate chains, EventCache, ReadModelStore, anticipated-updates map, cache-key entries — all of these can be touched in a single command's lifetime.
2. **Count the number of SQL writes** the operation produces.
   More writes mean more interleave points.
3. **Identify the points where competing identities could interleave.**
   Temp-ID-vs-server-ID is the canonical example.
   But also: a command being re-evaluated while a related command is being applied, a cache-key reconciliation while a read happens, a session change mid-write.
4. **Assess whether the system can self-correct.**
   Will the next sync, the next command, or the next gap-repair clean up the inconsistency?
   Or will the inconsistency persist and compound?
5. **Multiply by the number of pending commands.**
   The race window is per-command; N pending commands give N opportunities for the inconsistency to land.

A bug that scores "probably persists" or "compounds across pending commands" is a data-corruption bug regardless of how cosmetic the UI symptom looks.
Describe it as such.

## Anti-pattern

"It's just a brief visual flicker."

If the underlying race produces inconsistent storage state (even briefly), this framing fundamentally mischaracterises the risk.
The flicker is a side effect of the corruption, not the corruption itself.
The data on disk is wrong; the UI is just the most visible place that wrongness shows up.
