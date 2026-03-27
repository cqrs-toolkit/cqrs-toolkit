[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createSucceededCommand

# Function: createSucceededCommand()

> **createSucceededCommand**\<`TLink`, `TData`, `TResponse`\>(`response`, `overrides?`): [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TData`, `TResponse`\>

Create a succeeded command.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TData

`TData` = `unknown`

### TResponse

`TResponse` = `unknown`

## Parameters

### response

`TResponse`

### overrides?

`Partial`\<[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TData`, `TResponse`\>\> = `{}`

## Returns

[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TData`, `TResponse`\>
