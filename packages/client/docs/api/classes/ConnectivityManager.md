[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ConnectivityManager

# Class: ConnectivityManager\<TLink\>

Browser connectivity manager.
Tracks navigator.onLine status and API reachability via health checks.

## Extends

- `AbstractConnectivityManager`\<`TLink`\>

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Constructors

### Constructor

> **new ConnectivityManager**\<`TLink`\>(`eventBus`, `config?`): `ConnectivityManager`\<`TLink`\>

#### Parameters

##### eventBus

[`EventBus`](EventBus.md)\<`TLink`\>

##### config?

`ConnectivityManagerConfig` = `{}`

#### Returns

`ConnectivityManager`\<`TLink`\>

#### Overrides

`AbstractConnectivityManager<TLink>.constructor`

## Properties

### checkInterval

> `protected` `readonly` **checkInterval**: `number`

#### Inherited from

`AbstractConnectivityManager.checkInterval`

---

### checkTimer

> `protected` **checkTimer**: `number` \| `undefined`

#### Inherited from

`AbstractConnectivityManager.checkTimer`

---

### eventBus

> `protected` `readonly` **eventBus**: [`EventBus`](EventBus.md)\<`TLink`\>

#### Inherited from

`AbstractConnectivityManager.eventBus`

---

### healthCheckUrl

> `protected` `readonly` **healthCheckUrl**: `string` \| `undefined`

#### Inherited from

`AbstractConnectivityManager.healthCheckUrl`

---

### state$

> `protected` `readonly` **state$**: `BehaviorSubject`\<[`ConnectivityState`](../interfaces/ConnectivityState.md)\>

#### Inherited from

`AbstractConnectivityManager.state$`

---

### wsConnectionState

> `protected` **wsConnectionState**: [`WsConnectionState`](../type-aliases/WsConnectionState.md) = `'disconnected'`

WebSocket transport state — tracked internally, emitted as debug events.

#### Inherited from

`AbstractConnectivityManager.wsConnectionState`

---

### wsTopicList

> `protected` **wsTopicList**: `string`[] = `[]`

#### Inherited from

`AbstractConnectivityManager.wsTopicList`

## Accessors

### online$

#### Get Signature

> **get** **online$**(): `Observable`\<`boolean`\>

Observable of online status (browser + API reachable).

##### Returns

`Observable`\<`boolean`\>

#### Inherited from

`AbstractConnectivityManager.online$`

---

### state

#### Get Signature

> **get** **state**(): `Observable`\<[`ConnectivityState`](../interfaces/ConnectivityState.md)\>

Observable of connectivity state changes.

##### Returns

`Observable`\<[`ConnectivityState`](../interfaces/ConnectivityState.md)\>

#### Inherited from

`AbstractConnectivityManager.state`

## Methods

### checkApiConnectivity()

> `protected` **checkApiConnectivity**(): `Promise`\<`void`\>

Check API connectivity via health check endpoint.

#### Returns

`Promise`\<`void`\>

#### Inherited from

`AbstractConnectivityManager.checkApiConnectivity`

---

### destroy()

> **destroy**(): `void`

Clean up resources.

#### Returns

`void`

#### Inherited from

`AbstractConnectivityManager.destroy`

---

### getState()

> **getState**(): [`ConnectivityState`](../interfaces/ConnectivityState.md)

Get the current connectivity state.

#### Returns

[`ConnectivityState`](../interfaces/ConnectivityState.md)

#### Inherited from

`AbstractConnectivityManager.getState`

---

### isOnline()

> **isOnline**(): `boolean`

Check if we're effectively online.

#### Returns

`boolean`

#### Inherited from

`AbstractConnectivityManager.isOnline`

---

### reportContact()

> **reportContact**(): `void`

Report successful API contact.
Called by other components when API calls succeed.

#### Returns

`void`

#### Inherited from

`AbstractConnectivityManager.reportContact`

---

### reportFailure()

> **reportFailure**(): `void`

Report API failure.
Called by other components when API calls fail due to network.

#### Returns

`void`

#### Inherited from

`AbstractConnectivityManager.reportFailure`

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

#### Inherited from

`AbstractConnectivityManager.reportWsConnection`

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

#### Inherited from

`AbstractConnectivityManager.reportWsSubscribed`

---

### start()

> **start**(): `void`

Start monitoring connectivity.

#### Returns

`void`

#### Overrides

`AbstractConnectivityManager.start`

---

### stop()

> **stop**(): `void`

Stop monitoring connectivity.

#### Returns

`void`

#### Overrides

`AbstractConnectivityManager.stop`

---

### updateState()

> `protected` **updateState**(`updates`): `void`

Update state and emit events.

#### Parameters

##### updates

`Partial`\<[`ConnectivityState`](../interfaces/ConnectivityState.md)\>

#### Returns

`void`

#### Inherited from

`AbstractConnectivityManager.updateState`
