[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EnqueueOptions

# Interface: EnqueueOptions

Options for enqueue operation.

## Extended by

- [`EnqueueAndWaitOptions`](EnqueueAndWaitOptions.md)
- [`SubmitOptions`](SubmitOptions.md)

## Properties

### commandId?

> `optional` **commandId**: `string`

Custom command ID (defaults to generated UUID)

---

### skipValidation?

> `optional` **skipValidation**: `boolean`

Skip local domain validation
