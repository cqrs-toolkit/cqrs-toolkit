[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EntityCacheKey

# Interface: EntityCacheKey\<TLink\>

Entity cache key — tied to a concrete domain entity via a Link.
The link carries `{ type, id }` (or `{ service, type, id }` for ServiceLink).

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### key

> **key**: `string`

---

### kind

> **kind**: `"entity"`

---

### link

> **link**: `TLink`

---

### parentKey?

> `optional` **parentKey**: `string`
