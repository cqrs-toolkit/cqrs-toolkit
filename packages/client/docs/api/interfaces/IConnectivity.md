[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IConnectivity

# Interface: IConnectivity

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:46

Consumer-facing connectivity interface.
Both the real ConnectivityManager (online-only / worker-internal) and
ConnectivityProxy (main-thread in worker modes) implement this.

## Properties

### online$

> `readonly` **online$**: `Observable`\<`boolean`\>

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:52

Observable of online status (browser + API reachable).

---

### state

> `readonly` **state**: `Observable`\<[`ConnectivityState`](ConnectivityState.md)\>

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:50

Observable of connectivity state changes.

## Methods

### getState()

> **getState**(): [`ConnectivityState`](ConnectivityState.md)

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:48

Get the current connectivity state.

#### Returns

[`ConnectivityState`](ConnectivityState.md)

---

### isOnline()

> **isOnline**(): `boolean`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:54

Check if we're effectively online.

#### Returns

`boolean`
