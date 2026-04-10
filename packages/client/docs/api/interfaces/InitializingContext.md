[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / InitializingContext

# Interface: InitializingContext

Context for the first execution of a command handler.

## Properties

### commandId

> **commandId**: `string`

The command ID. Used by createEntityId to build EntityRef.

---

### idStrategy?

> `optional` **idStrategy**: `"temporary"` \| `"permanent"`

ID strategy from the creates config. Used by createEntityId to build EntityRef.

---

### phase

> **phase**: `"initializing"`

First execution for this command.
