[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CreateCommandConfig

# Interface: CreateCommandConfig

Configuration for commands that create new aggregates.

## Properties

### eventType

> **eventType**: `string`

Event type in the response to read the server-assigned ID from (data.id).

---

### idStrategy

> **idStrategy**: `"temporary"` \| `"permanent"`

Whether the client-generated ID is temporary (server replaces it) or permanent.
