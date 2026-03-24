[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ClientMetadata

# Interface: ClientMetadata

Client-side metadata for read model identity tracking.

Persists the original client-generated temp ID through ID reconciliation
so the UI can maintain stable entity references (selection, URLs) when the
server assigns a different permanent ID.

## Properties

### clientId

> **clientId**: `string`

Original client-generated temp ID, set at anticipated-event creation time.

---

### reconciledAt?

> `optional` **reconciledAt**: `number`

Timestamp when the server ID replaced the client ID. Undefined until reconciliation.
