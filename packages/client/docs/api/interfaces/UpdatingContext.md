[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / UpdatingContext

# Interface: UpdatingContext

Context for re-execution after dependency data changed (e.g., parent ID resolved).

## Properties

### entityId

> **entityId**: `string`

The entity ID established during initial execution. Create handlers should reuse this
instead of generating a new ID.

---

### phase

> **phase**: `"updating"`

Re-execution after dependency data changed.
