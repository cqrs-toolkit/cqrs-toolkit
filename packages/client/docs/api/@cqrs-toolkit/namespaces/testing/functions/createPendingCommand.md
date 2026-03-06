[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createPendingCommand

# Function: createPendingCommand()

> **createPendingCommand**\<`TPayload`\>(`overrides?`): [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TPayload`\>

Defined in: [packages/client/src/testing/factories/command.ts:36](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/testing/factories/command.ts#L36)

Create a pending command.

## Type Parameters

### TPayload

`TPayload` = `unknown`

## Parameters

### overrides?

`Partial`\<[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TPayload`\>\> = `{}`

## Returns

[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TPayload`\>
