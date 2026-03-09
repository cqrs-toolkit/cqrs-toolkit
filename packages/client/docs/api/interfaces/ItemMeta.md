[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ItemMeta

# Interface: ItemMeta

Identity and change-detection metadata for a single item.
Carried alongside query results so decorators (e.g. StableRefQueryManager)
can reconcile references without inspecting consumer data.

## Properties

### id

> `readonly` **id**: `string`

---

### updatedAt

> `readonly` **updatedAt**: `number`
