[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createPendingCommand

# Function: createPendingCommand()

> **createPendingCommand**\<`TLink`, `TData`\>(`overrides?`): [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TData`\>

Create a pending command.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TData

`TData` = `unknown`

## Parameters

### overrides?

`Partial`\<[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TData`\>\> = `{}`

## Returns

[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TData`\>
