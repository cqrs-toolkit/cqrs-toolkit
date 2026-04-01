[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createPendingCommand

# Function: createPendingCommand()

> **createPendingCommand**\<`TLink`, `TCommand`\>(`overrides?`): [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TCommand`\>

Create a pending command.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../../../../interfaces/EnqueueCommand.md)\<`unknown`\>

## Parameters

### overrides?

`Partial`\<[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TCommand`\>\> = `{}`

## Returns

[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TCommand`\>
