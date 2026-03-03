[**@cqrs-toolkit/client**](../../../../README.md)

***

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createSucceededCommand

# Function: createSucceededCommand()

> **createSucceededCommand**\<`TPayload`, `TResponse`\>(`response`, `overrides?`): [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TPayload`, `TResponse`\>

Defined in: packages/client/src/testing/factories/command.ts:60

Create a succeeded command.

## Type Parameters

### TPayload

`TPayload` = `unknown`

### TResponse

`TResponse` = `unknown`

## Parameters

### response

`TResponse`

### overrides?

`Partial`\<[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TPayload`, `TResponse`\>\> = `{}`

## Returns

[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TPayload`, `TResponse`\>
