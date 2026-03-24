[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createFailedCommand

# Function: createFailedCommand()

> **createFailedCommand**\<`TData`\>(`error`, `overrides?`): [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TData`\>

Create a failed command.

## Type Parameters

### TData

`TData` = `unknown`

## Parameters

### error

[`CommandError`](../../../../interfaces/CommandError.md) | `undefined`

### overrides?

`Partial`\<[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TData`\>\> = `{}`

## Returns

[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TData`\>
