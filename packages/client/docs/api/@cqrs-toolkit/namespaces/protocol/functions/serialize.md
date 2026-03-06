[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / serialize

# Function: serialize()

> **serialize**\<`T`\>(`value`): `unknown`

Defined in: [packages/client/src/protocol/serialization.ts:36](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/serialization.ts#L36)

Serialize a value for postMessage.
Converts BigInt and Date to serialization markers.

## Type Parameters

### T

`T`

## Parameters

### value

`T`

Value to serialize

## Returns

`unknown`

Serialized value safe for postMessage
