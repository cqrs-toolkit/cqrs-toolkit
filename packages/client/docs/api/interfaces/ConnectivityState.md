[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ConnectivityState

# Interface: ConnectivityState

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:26

Connectivity state.

## Properties

### lastContact?

> `optional` **lastContact**: `number`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:32

Last successful API contact timestamp

---

### network

> **network**: `"online"` \| `"offline"` \| `"unknown"`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:28

Whether the browser reports being online

---

### serverReachable

> **serverReachable**: `"unknown"` \| `"yes"` \| `"no"`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:30

Whether we've confirmed API connectivity

---

### wsConnection

> **wsConnection**: [`WsConnectionState`](../type-aliases/WsConnectionState.md)

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:34

WebSocket transport connection state

---

### wsTopics

> **wsTopics**: readonly `string`[]

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:36

Currently subscribed WebSocket topics
