[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / ConnectivityState

# Interface: ConnectivityState

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:19

Connectivity state.

## Properties

### apiReachable

> **apiReachable**: `boolean`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:23

Whether we've confirmed API connectivity

---

### lastContact

> **lastContact**: `number` \| `null`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:25

Last successful API contact timestamp

---

### online

> **online**: `boolean`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:21

Whether the browser reports being online
