[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IConnectivity

# Interface: IConnectivity

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:55](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L55)

Consumer-facing connectivity interface.
Both the real ConnectivityManager (online-only / worker-internal) and
ConnectivityProxy (main-thread in worker modes) implement this.

## Properties

### online$

> `readonly` **online$**: `Observable`\<`boolean`\>

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:61](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L61)

Observable of online status (browser + API reachable).

---

### state

> `readonly` **state**: `Observable`\<[`ConnectivityState`](ConnectivityState.md)\>

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:59](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L59)

Observable of connectivity state changes.

## Methods

### getState()

> **getState**(): [`ConnectivityState`](ConnectivityState.md)

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:57](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L57)

Get the current connectivity state.

#### Returns

[`ConnectivityState`](ConnectivityState.md)

---

### isOnline()

> **isOnline**(): `boolean`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:63](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L63)

Check if we're effectively online.

#### Returns

`boolean`
