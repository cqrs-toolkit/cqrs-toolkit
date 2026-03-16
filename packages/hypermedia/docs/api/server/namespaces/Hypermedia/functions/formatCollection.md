[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [server](../../../README.md) / [Hypermedia](../README.md) / formatCollection

# Function: formatCollection()

> **formatCollection**\<`T`, `Counts`\>(`req`, `desc`, `cfg`): `object`

## Type Parameters

### T

`T` _extends_ `object`

### Counts

`Counts` _extends_ `object` = `Record`\<`string`, `any`\>

## Parameters

### req

[`Request`](../interfaces/Request.md)

### desc

[`CollectionDescriptor`](../../../../index/namespaces/HypermediaTypes/interfaces/CollectionDescriptor.md)\<`T`, `Counts`\>

### cfg

[`CollectionFormatConfig`](../interfaces/CollectionFormatConfig.md)

## Returns

`object`

### body

> **body**: `Dict`

### contentType

> **contentType**: `string` = `MT_HAL`
