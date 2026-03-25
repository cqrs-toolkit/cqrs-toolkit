[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SeedRecord

# Interface: SeedRecord

A read model record returned from a seed endpoint.

## Properties

### data

> **data**: `Record`\<`string`, `unknown`\>

---

### id

> **id**: `string`

---

### position?

> `optional` **position**: `string`

Global position (bigint as string).

---

### revision?

> `optional` **revision**: `string`

Stream revision (bigint as string).
