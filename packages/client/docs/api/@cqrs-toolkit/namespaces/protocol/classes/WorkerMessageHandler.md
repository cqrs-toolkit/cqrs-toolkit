[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / WorkerMessageHandler

# Class: WorkerMessageHandler

Defined in: packages/client/src/protocol/MessageChannel.ts:324

Message handler for worker-side communication.

## Constructors

### Constructor

> **new WorkerMessageHandler**(`config?`): `WorkerMessageHandler`

Defined in: packages/client/src/protocol/MessageChannel.ts:342

#### Parameters

##### config?

[`MessageChannelConfig`](../interfaces/MessageChannelConfig.md) = `{}`

#### Returns

`WorkerMessageHandler`

## Accessors

### instanceId

#### Get Signature

> **get** **instanceId**(): `string`

Defined in: packages/client/src/protocol/MessageChannel.ts:353

Get the worker instance ID.

##### Returns

`string`

## Methods

### broadcastEvent()

> **broadcastEvent**(`eventName`, `payload`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:416

Broadcast an event to all connected windows.

#### Parameters

##### eventName

`string`

Event name

##### payload

`unknown`

Event payload

#### Returns

`void`

---

### getDeadWindows()

> **getDeadWindows**(`ttlMs`): `string`[]

Defined in: packages/client/src/protocol/MessageChannel.ts:469

Get dead windows (exceeded TTL).

#### Parameters

##### ttlMs

`number`

Time-to-live in milliseconds

#### Returns

`string`[]

Array of dead window IDs

---

### getRegisteredWindows()

> **getRegisteredWindows**(): `string`[]

Defined in: packages/client/src/protocol/MessageChannel.ts:444

Get registered window IDs.

#### Returns

`string`[]

---

### handleConnect()

> **handleConnect**(`port`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:362

Handle a new connection (SharedWorker).

#### Parameters

##### port

`MessagePort`

MessagePort from the connect event

#### Returns

`void`

---

### handleMessageEvent()

> **handleMessageEvent**(`event`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:383

Handle a message (Dedicated Worker).

#### Parameters

##### event

`MessageEvent`

Message event

#### Returns

`void`

---

### isWindowAlive()

> **isWindowAlive**(`windowId`, `ttlMs`): `boolean`

Defined in: packages/client/src/protocol/MessageChannel.ts:455

Check if a window is still alive (within TTL).

#### Parameters

##### windowId

`string`

Window identifier

##### ttlMs

`number`

Time-to-live in milliseconds

#### Returns

`boolean`

Whether the window is alive

---

### onWindowRemoved()

> **onWindowRemoved**(`callback`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:505

Register a callback for when a window is removed.

#### Parameters

##### callback

(`windowId`) => `Promise`\<`void`\>

Async callback receiving the removed window ID

#### Returns

`void`

---

### registerMethod()

> **registerMethod**(`method`, `handler`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:403

Register a method handler.

#### Parameters

##### method

`string`

Method name

##### handler

(`args`, `context`) => `Promise`\<`unknown`\>

Handler function

#### Returns

`void`

---

### removeWindow()

> **removeWindow**(`windowId`): `Promise`\<`void`\>

Defined in: packages/client/src/protocol/MessageChannel.ts:487

Remove a window registration and notify listeners.

#### Parameters

##### windowId

`string`

Window identifier

#### Returns

`Promise`\<`void`\>

---

### sendResponse()

> **sendResponse**(`response`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:433

Send response to requester (Dedicated Worker).

#### Parameters

##### response

[`WorkerMessage`](../type-aliases/WorkerMessage.md)

Response message

#### Returns

`void`

---

### sendWorkerInstance()

> **sendWorkerInstance**(): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:390

Send worker-instance message (Dedicated Worker startup).

#### Returns

`void`

---

### setRestoreHoldsHandler()

> **setRestoreHoldsHandler**(`handler`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:514

Register the handler for restore-holds requests.

#### Parameters

##### handler

(`data`) => `Promise`\<\{ `failedKeys`: `string`[]; `restoredKeys`: `string`[]; \}\>

Handler that restores holds and returns results

#### Returns

`void`
