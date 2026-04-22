[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / MessageChannelConfig

# Interface: MessageChannelConfig

Message channel configuration.

## Extended by

- [`WorkerMessageHandlerConfig`](WorkerMessageHandlerConfig.md)

## Properties

### debug?

> `optional` **debug**: `boolean`

Whether debug-only emissions via [WorkerMessageChannel.emitDebug](../classes/WorkerMessageChannel.md#emitdebug)
should fire. Mirrors [EventBus.debug](../../../../classes/EventBus.md#debug) semantics: when `false`,
`emitDebug` is a no-op so callers can emit unconditionally without
producing noise in non-debug runs. Defaults to `false`.

---

### requestTimeout?

> `optional` **requestTimeout**: `number`

Request timeout in milliseconds

---

### serializeMessages?

> `optional` **serializeMessages**: `boolean`

Whether to serialize messages (default: true)
