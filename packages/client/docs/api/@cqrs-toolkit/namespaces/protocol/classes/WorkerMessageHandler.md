[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / WorkerMessageHandler

# Class: WorkerMessageHandler

Message handler for worker-side communication.

## Constructors

### Constructor

> **new WorkerMessageHandler**(`config?`): `WorkerMessageHandler`

#### Parameters

##### config?

[`MessageChannelConfig`](../interfaces/MessageChannelConfig.md) = `{}`

#### Returns

`WorkerMessageHandler`

## Accessors

### instanceId

#### Get Signature

> **get** **instanceId**(): `string`

Get the worker instance ID.

##### Returns

`string`

## Methods

### broadcastEvent()

> **broadcastEvent**(`eventName`, `payload`, `debug?`): `void`

Broadcast an event to all connected windows.

#### Parameters

##### eventName

`string`

Event name

##### payload

`unknown`

Event payload

##### debug?

`boolean`

Whether this is a debug-only event

#### Returns

`void`

---

### getDeadWindows()

> **getDeadWindows**(`ttlMs`): `string`[]

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

Get registered window IDs.

#### Returns

`string`[]

---

### handleConnect()

> **handleConnect**(`port`): `void`

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

Send worker-instance message (Dedicated Worker startup).

#### Returns

`void`

---

### setRawMessageHook()

> **setRawMessageHook**(`hook`): `void`

Set a hook that intercepts raw MessageEvents before standard handling.

Used by startSharedWorker to intercept coordinator protocol messages
(which include `event.ports` Transferables) before standard deserialization.
The hook returns `true` if it handled the message (suppressing normal handling).

#### Parameters

##### hook

(`event`, `port`) => `boolean`

#### Returns

`void`

---

### setRestoreHoldsHandler()

> **setRestoreHoldsHandler**(`handler`): `void`

Register the handler for restore-holds requests.

#### Parameters

##### handler

(`data`) => `Promise`\<\{ `failedKeys`: `string`[]; `restoredKeys`: `string`[]; \}\>

Handler that restores holds and returns results

#### Returns

`void`
