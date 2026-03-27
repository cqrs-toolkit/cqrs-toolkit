[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createTestCommand

# Function: createTestCommand()

> **createTestCommand**\<`TLink`, `TData`, `TResponse`\>(`overrides?`): [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TData`, `TResponse`\>

Create a test command record.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TData

`TData` = `unknown`

### TResponse

`TResponse` = `unknown`

## Parameters

### overrides?

`Partial`\<[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TData`, `TResponse`\>\> = `{}`

Optional field overrides

## Returns

[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TData`, `TResponse`\>

Command record
