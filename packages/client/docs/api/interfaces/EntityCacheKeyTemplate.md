[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EntityCacheKeyTemplate

# Interface: EntityCacheKeyTemplate\<TLink\>

Entity cache key template — identity without a resolved `.key` UUID.
Consumers construct these as typed object literals and pass to `registerCacheKey`.

`link.id` may be an `EntityId` (string or EntityRef). When it's an EntityRef,
`registerCacheKey` auto-wires reconciliation from the embedded metadata.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### kind

> **kind**: `"entity"`

---

### link

> **link**: `TLink`

---

### parentKey?

> `optional` **parentKey**: `string`
