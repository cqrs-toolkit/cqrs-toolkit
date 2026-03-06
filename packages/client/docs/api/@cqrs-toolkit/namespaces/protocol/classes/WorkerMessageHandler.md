[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / WorkerMessageHandler

# Class: WorkerMessageHandler

Defined in: [packages/client/src/protocol/MessageChannel.ts:292](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L292)

Message handler for worker-side communication.

## Constructors

### Constructor

> **new WorkerMessageHandler**(`config?`): `WorkerMessageHandler`

Defined in: [packages/client/src/protocol/MessageChannel.ts:315](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L315)

#### Parameters

##### config?

[`MessageChannelConfig`](../interfaces/MessageChannelConfig.md) = `{}`

#### Returns

`WorkerMessageHandler`

## Accessors

### instanceId

#### Get Signature

> **get** **instanceId**(): `string`

Defined in: [packages/client/src/protocol/MessageChannel.ts:326](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L326)

Get the worker instance ID.

##### Returns

`string`

## Methods

### broadcastEvent()

> **broadcastEvent**(`eventName`, `payload`, `debug?`): `void`

Defined in: [packages/client/src/protocol/MessageChannel.ts:403](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L403)

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

Defined in: [packages/client/src/protocol/MessageChannel.ts:461](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L461)

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

Defined in: [packages/client/src/protocol/MessageChannel.ts:436](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L436)

Get registered window IDs.

#### Returns

`string`[]

---

### handleConnect()

> **handleConnect**(`port`): `void`

Defined in: [packages/client/src/protocol/MessageChannel.ts:346](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L346)

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

Defined in: [packages/client/src/protocol/MessageChannel.ts:368](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L368)

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

Defined in: [packages/client/src/protocol/MessageChannel.ts:447](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L447)

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

Defined in: [packages/client/src/protocol/MessageChannel.ts:497](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L497)

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

Defined in: [packages/client/src/protocol/MessageChannel.ts:389](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L389)

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

Defined in: [packages/client/src/protocol/MessageChannel.ts:479](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L479)

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

Defined in: [packages/client/src/protocol/MessageChannel.ts:425](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L425)

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

Defined in: [packages/client/src/protocol/MessageChannel.ts:375](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L375)

Send worker-instance message (Dedicated Worker startup).

#### Returns

`void`

---

### setRawMessageHook()

> **setRawMessageHook**(`hook`): `void`

Defined in: [packages/client/src/protocol/MessageChannel.ts:337](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L337)

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

Defined in: [packages/client/src/protocol/MessageChannel.ts:506](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/MessageChannel.ts#L506)

Register the handler for restore-holds requests.

#### Parameters

##### handler

(`data`) => `Promise`\<\{ `failedKeys`: `string`[]; `restoredKeys`: `string`[]; \}\>

Handler that restores holds and returns results

#### Returns

`void`
