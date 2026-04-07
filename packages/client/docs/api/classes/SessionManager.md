[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SessionManager

# Class: SessionManager\<TLink, TCommand\>

Session manager.
Coordinates user identity with persisted session data.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

## Constructors

### Constructor

> **new SessionManager**\<`TLink`, `TCommand`\>(`storage`, `eventBus`): `SessionManager`\<`TLink`, `TCommand`\>

#### Parameters

##### storage

[`IStorage`](../interfaces/IStorage.md)\<`TLink`, `TCommand`\>

##### eventBus

[`EventBus`](EventBus.md)\<`TLink`\>

#### Returns

`SessionManager`\<`TLink`, `TCommand`\>

## Methods

### getAuthState()

> **getAuthState**(): [`AuthState`](../type-aliases/AuthState.md)

Get the current authentication state.

#### Returns

[`AuthState`](../type-aliases/AuthState.md)

---

### getSessionState()

> **getSessionState**(): [`SessionState`](../type-aliases/SessionState.md)

Get the current session state.

#### Returns

[`SessionState`](../type-aliases/SessionState.md)

---

### getUserId()

> **getUserId**(): `string` \| `undefined`

Get the current user ID, if any.

#### Returns

`string` \| `undefined`

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Initialize the session manager.
Loads any existing session from storage.
Does not resume network activity.

#### Returns

`Promise`\<`void`\>

---

### isNetworkPaused()

> **isNetworkPaused**(): `boolean`

Check if network operations are paused.
Network is paused until authentication is confirmed.

#### Returns

`boolean`

---

### signalAuthenticated()

> **signalAuthenticated**(`userId`): `Promise`\<\{ `resumed`: `boolean`; \}\>

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

Signal that the user has been logged out.
Clears all session data and pauses network activity.

#### Returns

`Promise`\<`void`\>

---

### touchSession()

> **touchSession**(): `Promise`\<`void`\>

Touch the session to update last seen timestamp.
Should be called periodically during active use.

#### Returns

`Promise`\<`void`\>
