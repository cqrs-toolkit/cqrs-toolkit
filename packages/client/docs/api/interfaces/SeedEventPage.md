[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SeedEventPage

# Interface: SeedEventPage

Defined in: [packages/client/src/types/config.ts:122](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L122)

Result of an event seed page fetch.
Events are IPersistedEvent from ddd-es — the canonical hydrated event type.

## Properties

### events

> **events**: [`IPersistedEvent`](../type-aliases/IPersistedEvent.md)[]

Defined in: [packages/client/src/types/config.ts:123](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L123)

---

### nextCursor

> **nextCursor**: `string` \| `null`

Defined in: [packages/client/src/types/config.ts:124](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L124)
