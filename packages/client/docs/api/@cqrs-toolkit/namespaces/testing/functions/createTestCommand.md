[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createTestCommand

# Function: createTestCommand()

> **createTestCommand**\<`TLink`, `TCommand`, `TResponse`\>(`overrides?`): [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `TResponse`\>

Create a test command record.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../../../../interfaces/EnqueueCommand.md)\<`unknown`\>

### TResponse

`TResponse` = `unknown`

## Parameters

### overrides?

`Partial`\<[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `TResponse`\>\> = `{}`

Optional field overrides

## Returns

[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `TResponse`\>

Command record
