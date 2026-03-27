[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ConnectivityManager

# Class: ConnectivityManager\<TLink\>

Connectivity manager.
Tracks browser online status and API reachability.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Implements

- [`IConnectivity`](../interfaces/IConnectivity.md)

## Constructors

### Constructor

> **new ConnectivityManager**\<`TLink`\>(`config`): `ConnectivityManager`\<`TLink`\>

#### Parameters

##### config

[`ConnectivityManagerConfig`](../interfaces/ConnectivityManagerConfig.md)\<`TLink`\>

#### Returns

`ConnectivityManager`\<`TLink`\>

## Accessors

### online$

#### Get Signature

> **get** **online$**(): `Observable`\<`boolean`\>

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

Observable of connectivity state changes.

##### Returns

`Observable`\<[`ConnectivityState`](../interfaces/ConnectivityState.md)\>

Observable of connectivity state changes.

#### Implementation of

[`IConnectivity`](../interfaces/IConnectivity.md).[`state`](../interfaces/IConnectivity.md#state)

## Methods

### destroy()

> **destroy**(): `void`

Clean up resources.

#### Returns

`void`

---

### getState()

> **getState**(): [`ConnectivityState`](../interfaces/ConnectivityState.md)

Get the current connectivity state.

#### Returns

[`ConnectivityState`](../interfaces/ConnectivityState.md)

#### Implementation of

[`IConnectivity`](../interfaces/IConnectivity.md).[`getState`](../interfaces/IConnectivity.md#getstate)

---

### isOnline()

> **isOnline**(): `boolean`

Check if we're effectively online.

#### Returns

`boolean`

#### Implementation of

[`IConnectivity`](../interfaces/IConnectivity.md).[`isOnline`](../interfaces/IConnectivity.md#isonline)

---

### reportContact()

> **reportContact**(): `void`

Report successful API contact.
Called by other components when API calls succeed.

#### Returns

`void`

---

### reportFailure()

> **reportFailure**(): `void`

Report API failure.
Called by other components when API calls fail due to network.

#### Returns

`void`

---

### reportWsConnection()

> **reportWsConnection**(`wsConnection`): `void`

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

Start monitoring connectivity.

#### Returns

`void`

---

### stop()

> **stop**(): `void`

Stop monitoring connectivity.

#### Returns

`void`
