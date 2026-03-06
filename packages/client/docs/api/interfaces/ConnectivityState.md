[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ConnectivityState

# Interface: ConnectivityState

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:26](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L26)

Connectivity state.

## Properties

### lastContact?

> `optional` **lastContact**: `number`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:32](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L32)

Last successful API contact timestamp

---

### network

> **network**: `"online"` \| `"offline"` \| `"unknown"`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:28](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L28)

Whether the browser reports being online

---

### serverReachable

> **serverReachable**: `"unknown"` \| `"yes"` \| `"no"`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:30](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L30)

Whether we've confirmed API connectivity
