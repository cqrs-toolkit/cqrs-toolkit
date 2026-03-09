[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / WorkerMessageChannel

# Class: WorkerMessageChannel

Message channel for window-to-worker communication.

## Constructors

### Constructor

> **new WorkerMessageChannel**(`target`, `config?`): `WorkerMessageChannel`

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

Get observable of library events.

##### Returns

`Observable`\<[`EventMessage`](../interfaces/EventMessage.md)\>

---

### workerInstanceChanges$

#### Get Signature

> **get** **workerInstanceChanges$**(): `Observable`\<`string`\>

Get observable of worker instance changes.

##### Returns

`Observable`\<`string`\>

## Methods

### connect()

> **connect**(`source`): `void`

Start listening for messages.

#### Parameters

##### source

`EventTarget`

#### Returns

`void`

---

### destroy()

> **destroy**(): `void`

Destroy the channel.

#### Returns

`void`

---

### disconnect()

> **disconnect**(`source`): `void`

Stop listening for messages.

#### Parameters

##### source

`EventTarget`

#### Returns

`void`

---

### register()

> **register**(`windowId`): `Promise`\<[`RegisterWindowResponse`](../interfaces/RegisterWindowResponse.md)\>

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

Unregister a window.

#### Parameters

##### windowId

`string`

Window identifier

#### Returns

`void`
