[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EnqueueOptions

# Interface: EnqueueOptions

Defined in: [packages/client/src/types/commands.ts:95](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L95)

Options for enqueue operation.

## Extended by

- [`EnqueueAndWaitOptions`](EnqueueAndWaitOptions.md)
- [`SubmitOptions`](SubmitOptions.md)

## Properties

### commandId?

> `optional` **commandId**: `string`

Defined in: [packages/client/src/types/commands.ts:99](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L99)

Custom command ID (defaults to generated UUID)

---

### skipValidation?

> `optional` **skipValidation**: `boolean`

Defined in: [packages/client/src/types/commands.ts:97](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L97)

Skip local domain validation
