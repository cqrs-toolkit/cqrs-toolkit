[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EntityRef

# Interface: EntityRef

Entity reference carrying lifecycle metadata.

Present in read model data for locally-created entities with pending IDs.
Replaced by a plain string when the server confirms the entity.

EntityRef carries only identity and command lifecycle — not entity type.
Type information comes from the surrounding context: the read model
collection, the field name, or the Link object the ID is embedded in.

## Properties

### \_\_entityRef

> `readonly` **\_\_entityRef**: `true`

Discriminant for runtime identification.

---

### commandId

> `readonly` **commandId**: `string`

The command that created this entity.

---

### entityId

> `readonly` **entityId**: `string`

The current entity ID (client-generated).

---

### idStrategy

> `readonly` **idStrategy**: `"temporary"` \| `"permanent"`

Whether the server will replace this ID.
