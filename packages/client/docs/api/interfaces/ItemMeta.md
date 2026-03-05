[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ItemMeta

# Interface: ItemMeta

Defined in: packages/client/src/core/query-manager/types.ts:23

Identity and change-detection metadata for a single item.
Carried alongside query results so decorators (e.g. StableRefQueryManager)
can reconcile references without inspecting consumer data.

## Properties

### id

> `readonly` **id**: `string`

Defined in: packages/client/src/core/query-manager/types.ts:24

---

### updatedAt

> `readonly` **updatedAt**: `number`

Defined in: packages/client/src/core/query-manager/types.ts:25
