[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createSendingCommand

# Function: createSendingCommand()

> **createSendingCommand**\<`TLink`, `TCommand`\>(`overrides?`): [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TCommand`\>

Create a sending command.

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
