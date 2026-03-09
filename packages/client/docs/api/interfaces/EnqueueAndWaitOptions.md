[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EnqueueAndWaitOptions

# Interface: EnqueueAndWaitOptions

Options for enqueueAndWait operation.

## Extends

- [`EnqueueOptions`](EnqueueOptions.md).[`WaitOptions`](WaitOptions.md)

## Properties

### commandId?

> `optional` **commandId**: `string`

Custom command ID (defaults to generated UUID)

#### Inherited from

[`EnqueueOptions`](EnqueueOptions.md).[`commandId`](EnqueueOptions.md#commandid)

---

### skipValidation?

> `optional` **skipValidation**: `boolean`

Skip local domain validation

#### Inherited from

[`EnqueueOptions`](EnqueueOptions.md).[`skipValidation`](EnqueueOptions.md#skipvalidation)

---

### timeout?

> `optional` **timeout**: `number`

Timeout in milliseconds (default: 30000)

#### Inherited from

[`WaitOptions`](WaitOptions.md).[`timeout`](WaitOptions.md#timeout)
