[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EnqueueSuccess

# Interface: EnqueueSuccess\<TEvent\>

Defined in: [packages/client/src/types/commands.ts:118](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L118)

Successful enqueue payload.

## Type Parameters

### TEvent

`TEvent`

## Properties

### anticipatedEvents

> **anticipatedEvents**: `TEvent`[]

Defined in: [packages/client/src/types/commands.ts:122](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L122)

Anticipated events produced

---

### commandId

> **commandId**: `string`

Defined in: [packages/client/src/types/commands.ts:120](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L120)

Assigned command ID
