[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IConnectivity

# Interface: IConnectivity

Consumer-facing connectivity interface.
Both the real ConnectivityManager (online-only / worker-internal) and
ConnectivityProxy (main-thread in worker modes) implement this.

## Properties

### online$

> `readonly` **online$**: `Observable`\<`boolean`\>

Observable of online status (browser + API reachable).

---

### state

> `readonly` **state**: `Observable`\<[`ConnectivityState`](ConnectivityState.md)\>

Observable of connectivity state changes.

## Methods

### getState()

> **getState**(): [`ConnectivityState`](ConnectivityState.md)

Get the current connectivity state.

#### Returns

[`ConnectivityState`](ConnectivityState.md)

---

### isOnline()

> **isOnline**(): `boolean`

Check if we're effectively online.

#### Returns

`boolean`
