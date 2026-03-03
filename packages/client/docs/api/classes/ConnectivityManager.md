[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / ConnectivityManager

# Class: ConnectivityManager

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:44

Connectivity manager.
Tracks browser online status and API reachability.

## Constructors

### Constructor

> **new ConnectivityManager**(`config`): `ConnectivityManager`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:57

#### Parameters

##### config

[`ConnectivityManagerConfig`](../interfaces/ConnectivityManagerConfig.md)

#### Returns

`ConnectivityManager`

## Accessors

### online$

#### Get Signature

> **get** **online$**(): `Observable`\<`boolean`\>

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:80

Observable of online status (browser + API reachable).

##### Returns

`Observable`\<`boolean`\>

***

### state

#### Get Signature

> **get** **state**(): `Observable`\<[`ConnectivityState`](../interfaces/ConnectivityState.md)\>

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:73

Observable of connectivity state changes.

##### Returns

`Observable`\<[`ConnectivityState`](../interfaces/ConnectivityState.md)\>

## Methods

### destroy()

> **destroy**(): `void`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:206

Clean up resources.

#### Returns

`void`

***

### getState()

> **getState**(): [`ConnectivityState`](../interfaces/ConnectivityState.md)

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:66

Get the current connectivity state.

#### Returns

[`ConnectivityState`](../interfaces/ConnectivityState.md)

***

### isOnline()

> **isOnline**(): `boolean`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:90

Check if we're effectively online.

#### Returns

`boolean`

***

### reportContact()

> **reportContact**(): `void`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:146

Report successful API contact.
Called by other components when API calls succeed.

#### Returns

`void`

***

### reportFailure()

> **reportFailure**(): `void`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:158

Report API failure.
Called by other components when API calls fail due to network.

#### Returns

`void`

***

### start()

> **start**(): `void`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:98

Start monitoring connectivity.

#### Returns

`void`

***

### stop()

> **stop**(): `void`

Defined in: packages/client/src/core/sync-manager/ConnectivityManager.ts:135

Stop monitoring connectivity.

#### Returns

`void`
