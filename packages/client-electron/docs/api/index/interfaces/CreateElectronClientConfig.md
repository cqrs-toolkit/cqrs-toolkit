[**@cqrs-toolkit/client-electron**](../../README.md)

---

[@cqrs-toolkit/client-electron](../../modules.md) / [index](../README.md) / CreateElectronClientConfig

# Interface: CreateElectronClientConfig

Configuration for creating an Electron CQRS client.

## Properties

### debug?

> `optional` **debug**: `boolean`

Enable debug mode.

---

### port?

> `optional` **port**: `MessagePort`

Explicit MessagePort (bypasses the preload bridge).

---

### requestTimeout?

> `optional` **requestTimeout**: `number`

Request timeout in milliseconds (default: 30000).
