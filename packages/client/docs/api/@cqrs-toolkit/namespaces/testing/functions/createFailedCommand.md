[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createFailedCommand

# Function: createFailedCommand()

> **createFailedCommand**\<`TPayload`\>(`error`, `overrides?`): [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TPayload`\>

Defined in: [packages/client/src/testing/factories/command.ts:75](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/testing/factories/command.ts#L75)

Create a failed command.

## Type Parameters

### TPayload

`TPayload` = `unknown`

## Parameters

### error

[`CommandError`](../../../../interfaces/CommandError.md) | `undefined`

### overrides?

`Partial`\<[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TPayload`\>\> = `{}`

## Returns

[`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TPayload`\>
