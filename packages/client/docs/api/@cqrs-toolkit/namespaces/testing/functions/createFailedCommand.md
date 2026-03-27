[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createFailedCommand

# Function: createFailedCommand()

> **createFailedCommand**\<`TLink`, `TData`\>(`error`, `overrides?`): [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TData`\>

Create a failed command.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TData

`TData` = `unknown`

## Parameters

### error

[`CommandError`](../../../../interfaces/CommandError.md) | `undefined`

### overrides?

`Partial`\<[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TData`\>\> = `{}`

## Returns

[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TData`\>
