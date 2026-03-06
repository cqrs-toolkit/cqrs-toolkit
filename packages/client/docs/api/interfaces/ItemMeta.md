[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ItemMeta

# Interface: ItemMeta

Defined in: [packages/client/src/core/query-manager/types.ts:23](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/query-manager/types.ts#L23)

Identity and change-detection metadata for a single item.
Carried alongside query results so decorators (e.g. StableRefQueryManager)
can reconcile references without inspecting consumer data.

## Properties

### id

> `readonly` **id**: `string`

Defined in: [packages/client/src/core/query-manager/types.ts:24](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/query-manager/types.ts#L24)

---

### updatedAt

> `readonly` **updatedAt**: `number`

Defined in: [packages/client/src/core/query-manager/types.ts:25](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/query-manager/types.ts#L25)
