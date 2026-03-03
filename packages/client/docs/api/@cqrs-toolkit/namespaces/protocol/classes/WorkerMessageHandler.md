[**@cqrs-toolkit/client**](../../../../README.md)

***

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / WorkerMessageHandler

# Class: WorkerMessageHandler

Defined in: packages/client/src/protocol/MessageChannel.ts:317

Message handler for worker-side communication.

## Constructors

### Constructor

> **new WorkerMessageHandler**(`config?`): `WorkerMessageHandler`

Defined in: packages/client/src/protocol/MessageChannel.ts:327

#### Parameters

##### config?

[`MessageChannelConfig`](../interfaces/MessageChannelConfig.md) = `{}`

#### Returns

`WorkerMessageHandler`

## Accessors

### instanceId

#### Get Signature

> **get** **instanceId**(): `string`

Defined in: packages/client/src/protocol/MessageChannel.ts:338

Get the worker instance ID.

##### Returns

`string`

## Methods

### broadcastEvent()

> **broadcastEvent**(`eventName`, `payload`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:388

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

***

### getDeadWindows()

> **getDeadWindows**(`ttlMs`): `string`[]

Defined in: packages/client/src/protocol/MessageChannel.ts:441

Get dead windows (exceeded TTL).

#### Parameters

##### ttlMs

`number`

Time-to-live in milliseconds

#### Returns

`string`[]

Array of dead window IDs

***

### getRegisteredWindows()

> **getRegisteredWindows**(): `string`[]

Defined in: packages/client/src/protocol/MessageChannel.ts:416

Get registered window IDs.

#### Returns

`string`[]

***

### handleConnect()

> **handleConnect**(`port`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:347

Handle a new connection (SharedWorker).

#### Parameters

##### port

`MessagePort`

MessagePort from the connect event

#### Returns

`void`

***

### handleMessageEvent()

> **handleMessageEvent**(`event`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:368

Handle a message (Dedicated Worker).

#### Parameters

##### event

`MessageEvent`

Message event

#### Returns

`void`

***

### isWindowAlive()

> **isWindowAlive**(`windowId`, `ttlMs`): `boolean`

Defined in: packages/client/src/protocol/MessageChannel.ts:427

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

***

### registerMethod()

> **registerMethod**(`method`, `handler`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:378

Register a method handler.

#### Parameters

##### method

`string`

Method name

##### handler

(`args`) => `Promise`\<`unknown`\>

Handler function

#### Returns

`void`

***

### removeWindow()

> **removeWindow**(`windowId`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:459

Remove a window registration.

#### Parameters

##### windowId

`string`

Window identifier

#### Returns

`void`

***

### sendResponse()

> **sendResponse**(`response`): `void`

Defined in: packages/client/src/protocol/MessageChannel.ts:405

Send response to requester (Dedicated Worker).

#### Parameters

##### response

[`WorkerMessage`](../type-aliases/WorkerMessage.md)

Response message

#### Returns

`void`
