[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / PostProcessPlan

# Interface: PostProcessPlan

Post-processing plan for after server confirmation.
Used for temp ID replacement, cleanup, etc.

## Properties

### kind

> **kind**: `string`

Plan type identifier

---

### tempIds?

> `optional` **tempIds**: `Record`\<`string`, `string`\>

Mapping of temporary IDs to field paths in event data
