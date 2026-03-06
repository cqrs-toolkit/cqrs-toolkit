[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ConnectivityManagerConfig

# Interface: ConnectivityManagerConfig

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:38](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L38)

Connectivity manager configuration.

## Properties

### checkInterval?

> `optional` **checkInterval**: `number`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:41](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L41)

Interval to check API connectivity (ms)

---

### eventBus

> **eventBus**: [`EventBus`](../classes/EventBus.md)

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:39](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L39)

---

### healthCheckUrl?

> `optional` **healthCheckUrl**: `string`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:43](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L43)

API health check URL
