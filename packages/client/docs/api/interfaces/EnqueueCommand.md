[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EnqueueCommand

# Interface: EnqueueCommand\<TPayload\>

Command to enqueue.

## Type Parameters

### TPayload

`TPayload` = `unknown`

## Properties

### dependsOn?

> `optional` **dependsOn**: `string`[]

Commands this depends on (optional)

---

### payload

> **payload**: `TPayload`

Command payload

---

### service?

> `optional` **service**: `string`

Target service (optional, defaults to primary)

---

### type

> **type**: `string`

Command type
