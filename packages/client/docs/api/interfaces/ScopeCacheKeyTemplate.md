[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ScopeCacheKeyTemplate

# Interface: ScopeCacheKeyTemplate

Scope cache key template — identity without a resolved `.key` UUID.
Consumers construct these as typed object literals and pass to `registerCacheKey`.

`scopeParams` values may contain EntityRef objects. Default extraction scans
top-level values. Declare `entityRefPaths` for deeper structures.

**Warning:** Do not use `deriveScopeKey` when `scopeParams` contains EntityRef
values or temporary client-generated IDs — the UUID v5 derivation produces a
key that becomes orphaned when the ID resolves. Use `registerCacheKey` instead.

## Properties

### entityRefPaths?

> `optional` **entityRefPaths**: `string`[]

JSONPath expressions (RFC 9535 subset) for EntityRef values in nested
scopeParams structures. Default extraction scans top-level scopeParams values.
Declare paths here for deeper structures. Paths are relative to scopeParams.
Uses `[*]` for array wildcard.

#### Example

```ts
;['$.filter.orgId', '$.items[*].parentId']
```

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
