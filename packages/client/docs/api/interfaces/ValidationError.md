[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ValidationError

# Interface: ValidationError

Defined in: [packages/client/src/types/validation.ts:18](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/validation.ts#L18)

Generic validation error for a single field.

## Properties

### code?

> `optional` **code**: `string`

Defined in: [packages/client/src/types/validation.ts:24](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/validation.ts#L24)

Error code for programmatic handling (optional)

---

### context?

> `optional` **context**: `Record`\<`string`, `unknown`\>

Defined in: [packages/client/src/types/validation.ts:26](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/validation.ts#L26)

Additional context (optional)

---

### message

> **message**: `string`

Defined in: [packages/client/src/types/validation.ts:22](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/validation.ts#L22)

Error message for display

---

### path

> **path**: `string`

Defined in: [packages/client/src/types/validation.ts:20](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/validation.ts#L20)

Field path (e.g., "email", "address.city", "items[0].name")
