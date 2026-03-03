[**@cqrs-toolkit/client**](../../../../README.md)

***

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / serialize

# Function: serialize()

> **serialize**\<`T`\>(`value`): `unknown`

Defined in: packages/client/src/protocol/serialization.ts:36

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
