[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EnqueueCommand

# Interface: EnqueueCommand\<TPayload\>

Defined in: [packages/client/src/types/commands.ts:81](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L81)

Command to enqueue.

## Type Parameters

### TPayload

`TPayload` = `unknown`

## Properties

### dependsOn?

> `optional` **dependsOn**: `string`[]

Defined in: [packages/client/src/types/commands.ts:89](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L89)

Commands this depends on (optional)

---

### payload

> **payload**: `TPayload`

Defined in: [packages/client/src/types/commands.ts:85](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L85)

Command payload

---

### service?

> `optional` **service**: `string`

Defined in: [packages/client/src/types/commands.ts:87](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L87)

Target service (optional, defaults to primary)

---

### type

> **type**: `string`

Defined in: [packages/client/src/types/commands.ts:83](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L83)

Command type
