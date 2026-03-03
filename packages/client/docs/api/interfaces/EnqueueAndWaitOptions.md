[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / EnqueueAndWaitOptions

# Interface: EnqueueAndWaitOptions

Defined in: packages/client/src/types/commands.ts:108

Options for enqueueAndWait operation.

## Extends

- [`EnqueueOptions`](EnqueueOptions.md).[`WaitOptions`](WaitOptions.md)

## Properties

### commandId?

> `optional` **commandId**: `string`

Defined in: packages/client/src/types/commands.ts:94

Custom command ID (defaults to generated UUID)

#### Inherited from

[`EnqueueOptions`](EnqueueOptions.md).[`commandId`](EnqueueOptions.md#commandid)

---

### skipValidation?

> `optional` **skipValidation**: `boolean`

Defined in: packages/client/src/types/commands.ts:92

Skip local domain validation

#### Inherited from

[`EnqueueOptions`](EnqueueOptions.md).[`skipValidation`](EnqueueOptions.md#skipvalidation)

---

### timeout?

> `optional` **timeout**: `number`

Defined in: packages/client/src/types/commands.ts:102

Timeout in milliseconds (default: 30000)

#### Inherited from

[`WaitOptions`](WaitOptions.md).[`timeout`](WaitOptions.md#timeout)
