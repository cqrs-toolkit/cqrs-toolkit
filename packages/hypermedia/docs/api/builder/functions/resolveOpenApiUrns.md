[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [builder](../README.md) / resolveOpenApiUrns

# Function: resolveOpenApiUrns()

> **resolveOpenApiUrns**(`value`, `schemaUrns`): `unknown`

Walk an OpenAPI document and rewrite `$ref` URN values to URLs
using the known schema URN→URL map built during schema resolution.

## Parameters

### value

`unknown`

### schemaUrns

`ReadonlyMap`\<`string`, `string`\>

## Returns

`unknown`
