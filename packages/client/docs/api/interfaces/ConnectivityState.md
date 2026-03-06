[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ConnectivityState

# Interface: ConnectivityState

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:26](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L26)

Connectivity state.

## Properties

### lastContact?

> `optional` **lastContact**: `number`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:32](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L32)

Last successful API contact timestamp

---

### network

> **network**: `"online"` \| `"offline"` \| `"unknown"`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:28](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L28)

Whether the browser reports being online

---

### serverReachable

> **serverReachable**: `"unknown"` \| `"yes"` \| `"no"`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:30](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L30)

Whether we've confirmed API connectivity

---

### wsConnection

> **wsConnection**: [`WsConnectionState`](../type-aliases/WsConnectionState.md)

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:34](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L34)

WebSocket transport connection state

---

### wsTopics

> **wsTopics**: readonly `string`[]

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:36](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L36)

Currently subscribed WebSocket topics
