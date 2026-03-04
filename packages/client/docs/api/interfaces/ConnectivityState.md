[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ConnectivityState

# Interface: ConnectivityState

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:21

Connectivity state.

## Properties

### lastContact?

> `optional` **lastContact**: `number`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:27

Last successful API contact timestamp

---

### network

> **network**: `"offline"` \| `"online"` \| `"unknown"`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:23

Whether the browser reports being online

---

### serverReachable

> **serverReachable**: `"unknown"` \| `"yes"` \| `"no"`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:25

Whether we've confirmed API connectivity
