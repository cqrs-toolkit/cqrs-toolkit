[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandStoreConfig

# Interface: CommandStoreConfig

## Properties

### retainTerminal?

> `optional` **retainTerminal**: `boolean`

Whether to retain terminal commands in storage. Not yet fully implemented — stored as config only.

---

### terminalTtlMs?

> `optional` **terminalTtlMs**: `number`

TTL for terminal commands in the memory cache, in milliseconds. Default: 60000 (1 minute).
