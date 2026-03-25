[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ItemMeta

# Interface: ItemMeta

Identity and change-detection metadata for a single item.
Carried alongside query results so decorators (e.g. StableRefQueryManager)
can reconcile references without inspecting consumer data.

## Properties

### clientId?

> `readonly` `optional` **clientId**: `string`

Original client-generated temp ID. Present when the entity was created from a temp-ID create command.

---

### id

> `readonly` **id**: `string`

---

### revision?

> `readonly` `optional` **revision**: `string`

Stream revision (bigint as string). Present when the entity has been confirmed by the server.

---

### updatedAt

> `readonly` **updatedAt**: `number`
