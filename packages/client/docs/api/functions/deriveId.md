[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / deriveId

# Function: deriveId()

> **deriveId**(`name`, `namespace?`): `string`

Generate a deterministic UUID v5 from a name.

## Parameters

### name

`string`

The name to derive the UUID from

### namespace?

`string` = `CACHE_KEY_NAMESPACE`

Optional namespace UUID (defaults to CACHE_KEY_NAMESPACE)

## Returns

`string`

Deterministic UUID v5
