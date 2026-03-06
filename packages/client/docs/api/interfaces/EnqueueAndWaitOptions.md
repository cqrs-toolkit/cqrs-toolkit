[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EnqueueAndWaitOptions

# Interface: EnqueueAndWaitOptions

Defined in: [packages/client/src/types/commands.ts:113](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L113)

Options for enqueueAndWait operation.

## Extends

- [`EnqueueOptions`](EnqueueOptions.md).[`WaitOptions`](WaitOptions.md)

## Properties

### commandId?

> `optional` **commandId**: `string`

Defined in: [packages/client/src/types/commands.ts:99](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L99)

Custom command ID (defaults to generated UUID)

#### Inherited from

[`EnqueueOptions`](EnqueueOptions.md).[`commandId`](EnqueueOptions.md#commandid)

---

### skipValidation?

> `optional` **skipValidation**: `boolean`

Defined in: [packages/client/src/types/commands.ts:97](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L97)

Skip local domain validation

#### Inherited from

[`EnqueueOptions`](EnqueueOptions.md).[`skipValidation`](EnqueueOptions.md#skipvalidation)

---

### timeout?

> `optional` **timeout**: `number`

Defined in: [packages/client/src/types/commands.ts:107](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L107)

Timeout in milliseconds (default: 30000)

#### Inherited from

[`WaitOptions`](WaitOptions.md).[`timeout`](WaitOptions.md#timeout)
