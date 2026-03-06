[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SessionManager

# Class: SessionManager

Defined in: [packages/client/src/core/session/SessionManager.ts:39](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/session/SessionManager.ts#L39)

Session manager.
Coordinates user identity with persisted session data.

## Constructors

### Constructor

> **new SessionManager**(`config`): `SessionManager`

Defined in: [packages/client/src/core/session/SessionManager.ts:47](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/session/SessionManager.ts#L47)

#### Parameters

##### config

[`SessionManagerConfig`](../interfaces/SessionManagerConfig.md)

#### Returns

`SessionManager`

## Methods

### getAuthState()

> **getAuthState**(): [`AuthState`](../type-aliases/AuthState.md)

Defined in: [packages/client/src/core/session/SessionManager.ts:62](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/session/SessionManager.ts#L62)

Get the current authentication state.

#### Returns

[`AuthState`](../type-aliases/AuthState.md)

---

### getSessionState()

> **getSessionState**(): [`SessionState`](../type-aliases/SessionState.md)

Defined in: [packages/client/src/core/session/SessionManager.ts:55](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/session/SessionManager.ts#L55)

Get the current session state.

#### Returns

[`SessionState`](../type-aliases/SessionState.md)

---

### getUserId()

> **getUserId**(): `string` \| `undefined`

Defined in: [packages/client/src/core/session/SessionManager.ts:77](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/session/SessionManager.ts#L77)

Get the current user ID, if any.

#### Returns

`string` \| `undefined`

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Defined in: [packages/client/src/core/session/SessionManager.ts:89](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/session/SessionManager.ts#L89)

Initialize the session manager.
Loads any existing session from storage.
Does not resume network activity.

#### Returns

`Promise`\<`void`\>

---

### isNetworkPaused()

> **isNetworkPaused**(): `boolean`

Defined in: [packages/client/src/core/session/SessionManager.ts:70](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/session/SessionManager.ts#L70)

Check if network operations are paused.
Network is paused until authentication is confirmed.

#### Returns

`boolean`

---

### signalAuthenticated()

> **signalAuthenticated**(`userId`): `Promise`\<\{ `resumed`: `boolean`; \}\>

Defined in: [packages/client/src/core/session/SessionManager.ts:111](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/session/SessionManager.ts#L111)

Signal that the user has been authenticated.
This is called by the host application after successful authentication.

If the userId differs from the cached session, all data is wiped.

#### Parameters

##### userId

`string`

The authenticated user's ID

#### Returns

`Promise`\<\{ `resumed`: `boolean`; \}\>

Whether the session was resumed (true) or created new (false)

---

### signalLoggedOut()

> **signalLoggedOut**(): `Promise`\<`void`\>

Defined in: [packages/client/src/core/session/SessionManager.ts:150](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/session/SessionManager.ts#L150)

Signal that the user has been logged out.
Clears all session data and pauses network activity.

#### Returns

`Promise`\<`void`\>

---

### touchSession()

> **touchSession**(): `Promise`\<`void`\>

Defined in: [packages/client/src/core/session/SessionManager.ts:166](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/session/SessionManager.ts#L166)

Touch the session to update last seen timestamp.
Should be called periodically during active use.

#### Returns

`Promise`\<`void`\>
