[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ScopeCacheKey

# Interface: ScopeCacheKey

Scope cache key — a logical data scope not tied to a single entity.
Examples: "home task list", "search results with filters X".

## Properties

### key

> **key**: `string`

---

### kind

> **kind**: `"scope"`

---

### parentKey?

> `optional` **parentKey**: `string`

---

### scopeParams?

> `optional` **scopeParams**: `Record`\<`string`, `unknown`\>

---

### scopeType

> **scopeType**: `string`

---

### service?

> `optional` **service**: `string`
