[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createFailedCommand

# Function: createFailedCommand()

> **createFailedCommand**\<`TPayload`\>(`error`, `overrides?`): [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TPayload`\>

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
