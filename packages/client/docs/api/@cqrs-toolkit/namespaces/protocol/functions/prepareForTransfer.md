[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / prepareForTransfer

# Function: prepareForTransfer()

> **prepareForTransfer**\<`T`\>(`value`): `unknown`

Defined in: [packages/client/src/protocol/serialization.ts:183](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/serialization.ts#L183)

Create a structured clone-safe copy of a value.
Use this before postMessage when you're unsure if a value contains special types.

## Type Parameters

### T

`T`

## Parameters

### value

`T`

Value to prepare for postMessage

## Returns

`unknown`

Clone-safe value
