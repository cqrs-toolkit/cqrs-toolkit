[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / templateToIdentity

# Function: templateToIdentity()

> **templateToIdentity**\<`TLink`\>(`template`, `key`): [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Build a CacheKeyIdentity from a template and a resolved key UUID.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

## Parameters

### template

[`CacheKeyTemplate`](../type-aliases/CacheKeyTemplate.md)\<`TLink`\>

### key

`string`

## Returns

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>
