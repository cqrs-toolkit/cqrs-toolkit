[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createSucceededCommand

# Function: createSucceededCommand()

> **createSucceededCommand**\<`TLink`, `TCommand`, `TResponse`\>(`response`, `overrides?`): [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `TResponse`\>

Create a succeeded command.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../../../../interfaces/EnqueueCommand.md)\<`unknown`\>

### TResponse

`TResponse` = `unknown`

## Parameters

### response

`TResponse`

### overrides?

`Partial`\<[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `TResponse`\>\> = `{}`

## Returns

[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `TResponse`\>
