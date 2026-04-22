[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / WorkerMessageChannel

# Class: WorkerMessageChannel

Message channel for window-to-worker communication.

Also acts as an IEventSink for this thread. `emit`/`emitDebug`
push library events straight into the local `events$` subject — they
never cross `postMessage` — so any main-thread producer (logger,
future local-only announcers, etc.) can surface events on
`libraryEvents$` alongside events forwarded from the worker. One
stream, one source of truth per thread, regardless of event origin.

## Implements

- `IEventSink`\<`any`\>

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

### emit()

> **emit**\<`T`\>(`type`, `data`): `void`

#### Type Parameters

##### T

`T` _extends_ [`LibraryEventType`](../../../../type-aliases/LibraryEventType.md)

#### Parameters

##### type

`T`

##### data

[`LibraryEventData`](../../../../interfaces/LibraryEventData.md)\<`any`\>\[`T`\]

#### Returns

`void`

#### Implementation of

`IEventSink.emit`

---

### emitDebug()

> **emitDebug**\<`T`\>(`type`, `data`): `void`

#### Type Parameters

##### T

`T` _extends_ [`LibraryEventType`](../../../../type-aliases/LibraryEventType.md)

#### Parameters

##### type

`T`

##### data

[`LibraryEventData`](../../../../interfaces/LibraryEventData.md)\<`any`\>\[`T`\]

#### Returns

`void`

#### Implementation of

`IEventSink.emitDebug`

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
