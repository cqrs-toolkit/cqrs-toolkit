[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / WorkerMessageChannel

# Class: WorkerMessageChannel

Defined in: packages/client/src/protocol/MessageChannel.ts:73

Message channel for window-to-worker communication.

## Constructors

### Constructor

> **new WorkerMessageChannel**(`target`, `config?`): `WorkerMessageChannel`

Defined in: packages/client/src/protocol/MessageChannel.ts:83

#### Parameters

##### target

[`MessageTarget`](../interfaces/MessageTarget.md)

##### config?

[`MessageChannelConfig`](../interfaces/MessageChannelConfig.md) = `{}`

#### Returns

`WorkerMessageChannel`

## Accessors

### libraryEvents$

#### Get Signature

> **get** **libraryEvents$**(): `Observable`\<[`EventMessage`](../interfaces/EventMessage.md)\>

Defined in: packages/client/src/protocol/MessageChannel.ts:260

Get observable of library events.

##### Returns

`Observable`\<[`EventMessage`](../interfaces/EventMessage.md)\>

---

### workerInstanceChanges$

#### Get Signature

> **get** **workerInstanceChanges$**(): `Observable`\<`string`\>

Defined in: packages/client/src/protocol/MessageChannel.ts:267

Get observable of worker instance changes.

##### Returns

`Observable`\<`string`\>

## Methods

### connect()

> **connect**(`source`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:94

Start listening for messages.

#### Parameters

##### source

`EventTarget`

#### Returns

`void`

---

### destroy()

> **destroy**(): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:282

Destroy the channel.

#### Returns

`void`

---

### disconnect()

> **disconnect**(`source`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:119

Stop listening for messages.

#### Parameters

##### source

`EventTarget`

#### Returns

`void`

---

### register()

> **register**(`windowId`): `Promise`\<[`RegisterWindowResponse`](../interfaces/RegisterWindowResponse.md)\>

Defined in: packages/client/src/protocol/MessageChannel.ts:173

Register a window with the worker.

#### Parameters

##### windowId

`string`

Window identifier

#### Returns

`Promise`\<[`RegisterWindowResponse`](../interfaces/RegisterWindowResponse.md)\>

Registration response

---

### request()

> **request**\<`T`\>(`method`, `args?`): `Promise`\<`T`\>

Defined in: packages/client/src/protocol/MessageChannel.ts:133

Send a request and wait for response.

#### Type Parameters

##### T

`T`

#### Parameters

##### method

`string`

Method name to invoke

##### args?

`unknown`[] = `[]`

Method arguments

#### Returns

`Promise`\<`T`\>

Response result

---

### restoreHolds()

> **restoreHolds**(`windowId`, `cacheKeys`): `Promise`\<[`RestoreHoldsResponse`](../interfaces/RestoreHoldsResponse.md)\>

Defined in: packages/client/src/protocol/MessageChannel.ts:231

Restore holds after worker restart.

#### Parameters

##### windowId

`string`

Window identifier

##### cacheKeys

`string`[]

Cache keys to restore

#### Returns

`Promise`\<[`RestoreHoldsResponse`](../interfaces/RestoreHoldsResponse.md)\>

Restoration response

---

### sendHeartbeat()

> **sendHeartbeat**(`windowId`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:203

Send a heartbeat.

#### Parameters

##### windowId

`string`

Window identifier

#### Returns

`void`

---

### unregister()

> **unregister**(`windowId`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:216

Unregister a window.

#### Parameters

##### windowId

`string`

Window identifier

#### Returns

`void`
