[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ConnectivityManager

# Class: ConnectivityManager

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:70](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L70)

Connectivity manager.
Tracks browser online status and API reachability.

## Implements

- [`IConnectivity`](../interfaces/IConnectivity.md)

## Constructors

### Constructor

> **new ConnectivityManager**(`config`): `ConnectivityManager`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:86](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L86)

#### Parameters

##### config

[`ConnectivityManagerConfig`](../interfaces/ConnectivityManagerConfig.md)

#### Returns

`ConnectivityManager`

## Accessors

### online$

#### Get Signature

> **get** **online$**(): `Observable`\<`boolean`\>

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:109](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L109)

Observable of online status (browser + API reachable).

##### Returns

`Observable`\<`boolean`\>

Observable of online status (browser + API reachable).

#### Implementation of

[`IConnectivity`](../interfaces/IConnectivity.md).[`online$`](../interfaces/IConnectivity.md#online)

---

### state

#### Get Signature

> **get** **state**(): `Observable`\<[`ConnectivityState`](../interfaces/ConnectivityState.md)\>

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:102](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L102)

Observable of connectivity state changes.

##### Returns

`Observable`\<[`ConnectivityState`](../interfaces/ConnectivityState.md)\>

Observable of connectivity state changes.

#### Implementation of

[`IConnectivity`](../interfaces/IConnectivity.md).[`state`](../interfaces/IConnectivity.md#state)

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:282](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L282)

Clean up resources.

#### Returns

`void`

---

### getState()

> **getState**(): [`ConnectivityState`](../interfaces/ConnectivityState.md)

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:95](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L95)

Get the current connectivity state.

#### Returns

[`ConnectivityState`](../interfaces/ConnectivityState.md)

#### Implementation of

[`IConnectivity`](../interfaces/IConnectivity.md).[`getState`](../interfaces/IConnectivity.md#getstate)

---

### isOnline()

> **isOnline**(): `boolean`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:119](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L119)

Check if we're effectively online.

#### Returns

`boolean`

#### Implementation of

[`IConnectivity`](../interfaces/IConnectivity.md).[`isOnline`](../interfaces/IConnectivity.md#isonline)

---

### reportContact()

> **reportContact**(): `void`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:188](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L188)

Report successful API contact.
Called by other components when API calls succeed.

#### Returns

`void`

---

### reportFailure()

> **reportFailure**(): `void`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:200](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L200)

Report API failure.
Called by other components when API calls fail due to network.

#### Returns

`void`

---

### reportWsConnection()

> **reportWsConnection**(`wsConnection`): `void`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:209](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L209)

Report WebSocket connection state transition.
Emits the corresponding ws:\* debug event when the state changes.
On disconnect, clears subscribed topics.

#### Parameters

##### wsConnection

[`WsConnectionState`](../type-aliases/WsConnectionState.md)

#### Returns

`void`

---

### reportWsSubscribed()

> **reportWsSubscribed**(`topics`): `void`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:231](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L231)

Report WebSocket topics confirmed by the server.
Merges with existing topics and emits ws:subscribed.

#### Parameters

##### topics

readonly `string`[]

#### Returns

`void`

---

### start()

> **start**(): `void`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:127](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L127)

Start monitoring connectivity.

#### Returns

`void`

---

### stop()

> **stop**(): `void`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:173](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/sync-manager/ConnectivityManager.ts#L173)

Stop monitoring connectivity.

#### Returns

`void`
