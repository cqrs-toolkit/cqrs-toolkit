[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ConnectivityState

# Interface: ConnectivityState

Connectivity state.

## Properties

### lastContact?

> `optional` **lastContact**: `number`

Last successful API contact timestamp

---

### network

> **network**: `"online"` \| `"offline"` \| `"unknown"`

Whether the browser reports being online

---

### serverReachable

> **serverReachable**: `"unknown"` \| `"yes"` \| `"no"`

Whether we've confirmed API connectivity
