[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ConnectivityManagerConfig

# Interface: ConnectivityManagerConfig\<TLink\>

Connectivity manager configuration.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### checkInterval?

> `optional` **checkInterval**: `number`

Interval to check API connectivity (ms)

---

### eventBus

> **eventBus**: [`EventBus`](../classes/EventBus.md)\<`TLink`\>

---

### healthCheckUrl?

> `optional` **healthCheckUrl**: `string`

API health check URL
