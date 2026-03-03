[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / EnqueueCommand

# Interface: EnqueueCommand\<TPayload\>

Defined in: packages/client/src/types/commands.ts:76

Command to enqueue.

## Type Parameters

### TPayload

`TPayload` = `unknown`

## Properties

### dependsOn?

> `optional` **dependsOn**: `string`[]

Defined in: packages/client/src/types/commands.ts:84

Commands this depends on (optional)

---

### payload

> **payload**: `TPayload`

Defined in: packages/client/src/types/commands.ts:80

Command payload

---

### service?

> `optional` **service**: `string`

Defined in: packages/client/src/types/commands.ts:82

Target service (optional, defaults to primary)

---

### type

> **type**: `string`

Defined in: packages/client/src/types/commands.ts:78

Command type
