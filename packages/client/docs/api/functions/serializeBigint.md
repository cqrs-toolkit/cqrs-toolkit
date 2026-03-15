[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / serializeBigint

# Function: serializeBigint()

> **serializeBigint**(`value`): `string` \| `undefined`

Serialize a bigint value to a string for storage in read models.

Handles the common serialization cases:

- `bigint` → string representation
- `string` containing a valid integer → passed through
- `undefined` → `undefined` (absent values stay absent)

Rejects invalid inputs (e.g., `String(undefined)` = `"undefined"`) that would
silently produce corrupt data.

## Parameters

### value

`string` | `bigint` | `undefined`

## Returns

`string` \| `undefined`
