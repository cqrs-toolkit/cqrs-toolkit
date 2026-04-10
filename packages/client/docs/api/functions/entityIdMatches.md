[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / entityIdMatches

# Function: entityIdMatches()

> **entityIdMatches**(`a`, `b`): `boolean`

Lenient match: same logical entity regardless of lifecycle state.

Compares resolved string IDs only. A string `'abc'` matches an EntityRef
with `entityId: 'abc'`. Useful for finding an entity across reconciliation
boundaries where the lifecycle representation has changed.

## Parameters

### a

[`EntityId`](../type-aliases/EntityId.md) | `undefined`

### b

[`EntityId`](../type-aliases/EntityId.md) | `undefined`

## Returns

`boolean`
