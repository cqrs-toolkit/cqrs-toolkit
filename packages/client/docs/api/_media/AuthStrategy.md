[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / AuthStrategy

# Interface: AuthStrategy

Auth strategy for transport-level authentication.

Consumers implement this interface to control how auth headers are sent
with HTTP requests and how WebSocket connections are authenticated.
All hooks are optional — omitting a hook means no auth action for that transport.

## Methods

### authenticateWebSocket()?

> `optional` **authenticateWebSocket**(`socket`): `Promise`\<`void`\>

Called after `onopen`, before application messages. Resolve when auth is complete. Reject to abort and trigger reconnect.

#### Parameters

##### socket

`WebSocket`

#### Returns

`Promise`\<`void`\>

---

### getHttpHeaders()?

> `optional` **getHttpHeaders**(): `Promise`\<`Record`\<`string`, `string`\>\>

Called before every HTTP fetch (seed, gap repair). Returns headers to merge.

#### Returns

`Promise`\<`Record`\<`string`, `string`\>\>

---

### prepareWebSocketUrl()?

> `optional` **prepareWebSocketUrl**(`url`): `Promise`\<`string`\>

Called before `new WebSocket()`. Returns the final URL (append tokens, tickets, etc.).

#### Parameters

##### url

`string`

#### Returns

`Promise`\<`string`\>
