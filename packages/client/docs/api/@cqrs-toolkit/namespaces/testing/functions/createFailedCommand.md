[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createFailedCommand

# Function: createFailedCommand()

> **createFailedCommand**\<`TLink`, `TCommand`\>(`error`, `overrides?`): [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TCommand`\>

Create a failed command.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../../../../interfaces/EnqueueCommand.md)\<`unknown`\>

## Parameters

### error

[`CommandError`](../../../../interfaces/CommandError.md) | `undefined`

### overrides?

`Partial`\<[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TCommand`\>\> = `{}`

## Returns

[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TCommand`\>
