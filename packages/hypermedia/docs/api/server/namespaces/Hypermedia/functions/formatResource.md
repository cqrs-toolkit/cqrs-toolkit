[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [server](../../../README.md) / [Hypermedia](../README.md) / formatResource

# Function: formatResource()

> **formatResource**\<`T`\>(`req`, `desc`, `cfg`): \{ `body`: `Dict`; `contentType`: `string`; \} \| \{ `body`: `T`; `contentType`: `string`; \}

## Type Parameters

### T

`T` _extends_ `object`

## Parameters

### req

[`Request`](../interfaces/Request.md)

### desc

[`ResourceDescriptor`](../../../../index/namespaces/HypermediaTypes/interfaces/ResourceDescriptor.md)\<`T`\>

### cfg

[`ResourceFormatConfig`](../interfaces/ResourceFormatConfig.md)

## Returns

\{ `body`: `Dict`; `contentType`: `string`; \} \| \{ `body`: `T`; `contentType`: `string`; \}
