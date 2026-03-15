[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / autoRevision

# Function: autoRevision()

> **autoRevision**(`fallback?`): [`AutoRevision`](../interfaces/AutoRevision.md)

Create an auto-revision marker with an optional fallback revision.

## Parameters

### fallback?

`string`

The current revision from the read model. Used when no
pending commands exist for this aggregate. Typically `item.latestRevision`.

## Returns

[`AutoRevision`](../interfaces/AutoRevision.md)
