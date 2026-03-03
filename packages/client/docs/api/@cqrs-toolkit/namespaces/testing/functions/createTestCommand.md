[**@cqrs-toolkit/client**](../../../../README.md)

***

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createTestCommand

# Function: createTestCommand()

> **createTestCommand**\<`TPayload`, `TResponse`\>(`overrides?`): [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TPayload`, `TResponse`\>

Defined in: packages/client/src/testing/factories/command.ts:14

Create a test command record.

## Type Parameters

### TPayload

`TPayload` = `unknown`

### TResponse

`TResponse` = `unknown`

## Parameters

### overrides?

`Partial`\<[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TPayload`, `TResponse`\>\> = `{}`

Optional field overrides

## Returns

[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TPayload`, `TResponse`\>

Command record
