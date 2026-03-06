[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ConnectivityManager

# Class: ConnectivityManager

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:66](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L66)

Connectivity manager.
Tracks browser online status and API reachability.

## Implements

- [`IConnectivity`](../interfaces/IConnectivity.md)

## Constructors

### Constructor

> **new ConnectivityManager**(`config`): `ConnectivityManager`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:84](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L84)

#### Parameters

##### config

[`ConnectivityManagerConfig`](../interfaces/ConnectivityManagerConfig.md)

#### Returns

`ConnectivityManager`

## Accessors

### online$

#### Get Signature

> **get** **online$**(): `Observable`\<`boolean`\>

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:107](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L107)

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

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:100](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L100)

Observable of connectivity state changes.

##### Returns

`Observable`\<[`ConnectivityState`](../interfaces/ConnectivityState.md)\>

Observable of connectivity state changes.

#### Implementation of

[`IConnectivity`](../interfaces/IConnectivity.md).[`state`](../interfaces/IConnectivity.md#state)

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:276](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L276)

Clean up resources.

#### Returns

`void`

---

### getState()

> **getState**(): [`ConnectivityState`](../interfaces/ConnectivityState.md)

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:93](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L93)

Get the current connectivity state.

#### Returns

[`ConnectivityState`](../interfaces/ConnectivityState.md)

#### Implementation of

[`IConnectivity`](../interfaces/IConnectivity.md).[`getState`](../interfaces/IConnectivity.md#getstate)

---

### isOnline()

> **isOnline**(): `boolean`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:117](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L117)

Check if we're effectively online.

#### Returns

`boolean`

#### Implementation of

[`IConnectivity`](../interfaces/IConnectivity.md).[`isOnline`](../interfaces/IConnectivity.md#isonline)

---

### reportContact()

> **reportContact**(): `void`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:186](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L186)

Report successful API contact.
Called by other components when API calls succeed.

#### Returns

`void`

---

### reportFailure()

> **reportFailure**(): `void`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:198](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L198)

Report API failure.
Called by other components when API calls fail due to network.

#### Returns

`void`

---

### reportWsConnection()

> **reportWsConnection**(`wsConnection`): `void`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:207](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L207)

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

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:226](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L226)

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

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:125](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L125)

Start monitoring connectivity.

#### Returns

`void`

---

### stop()

> **stop**(): `void`

Defined in: [packages/client/src/core/sync-manager/ConnectivityManager.ts:171](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/ConnectivityManager.ts#L171)

Stop monitoring connectivity.

#### Returns

`void`
