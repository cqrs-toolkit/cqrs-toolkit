[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / UpdatingContext

# Interface: UpdatingContext

Context for re-execution after dependency data changed (e.g., parent ID resolved).

## Properties

### commandId

> **commandId**: `string`

The command ID. Used by createEntityId to build EntityRef.

---

### entityId

> **entityId**: `string`

The entity ID established during initial execution. Create handlers should reuse this
instead of generating a new ID.

---

### idStrategy?

> `optional` **idStrategy**: `"temporary"` \| `"permanent"`

ID strategy from the creates config. Used by createEntityId to build EntityRef.

---

### phase

> **phase**: `"updating"`

Re-execution after dependency data changed.
