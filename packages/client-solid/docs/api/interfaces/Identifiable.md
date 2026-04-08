[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / Identifiable

# Interface: Identifiable

Constraint for queryable items — must have an `id` property.
The id is `EntityId` (string | EntityRef): plain string for server-confirmed
entities, EntityRef for locally-created entities with pending IDs.

## Properties

### id

> `readonly` **id**: `EntityId`
