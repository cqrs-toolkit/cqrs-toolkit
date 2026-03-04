[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ConnectivityManager

# Class: ConnectivityManager

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:45

Connectivity manager.
Tracks browser online status and API reachability.

## Constructors

### Constructor

> **new ConnectivityManager**(`config`): `ConnectivityManager`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:59

#### Parameters

##### config

[`ConnectivityManagerConfig`](../interfaces/ConnectivityManagerConfig.md)

#### Returns

`ConnectivityManager`

## Accessors

### online$

#### Get Signature

> **get** **online$**(): `Observable`\<`boolean`\>

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:82

Observable of online status (browser + API reachable).

##### Returns

`Observable`\<`boolean`\>

---

### state

#### Get Signature

> **get** **state**(): `Observable`\<[`ConnectivityState`](../interfaces/ConnectivityState.md)\>

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:75

Observable of connectivity state changes.

##### Returns

`Observable`\<[`ConnectivityState`](../interfaces/ConnectivityState.md)\>

## Methods

### destroy()

> **destroy**(): `void`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:218

Clean up resources.

#### Returns

`void`

---

### getState()

> **getState**(): [`ConnectivityState`](../interfaces/ConnectivityState.md)

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:68

Get the current connectivity state.

#### Returns

[`ConnectivityState`](../interfaces/ConnectivityState.md)

---

### isOnline()

> **isOnline**(): `boolean`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:92

Check if we're effectively online.

#### Returns

`boolean`

---

### reportContact()

> **reportContact**(): `void`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:158

Report successful API contact.
Called by other components when API calls succeed.

#### Returns

`void`

---

### reportFailure()

> **reportFailure**(): `void`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:170

Report API failure.
Called by other components when API calls fail due to network.

#### Returns

`void`

---

### start()

> **start**(): `void`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:100

Start monitoring connectivity.

#### Returns

`void`

---

### stop()

> **stop**(): `void`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:143

Stop monitoring connectivity.

#### Returns

`void`
