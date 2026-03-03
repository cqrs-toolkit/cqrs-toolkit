[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / NetworkConfig

# Interface: NetworkConfig

Defined in: packages/client/src/types/config.ts:43

Network configuration.

## Properties

### baseUrl

> **baseUrl**: `string`

Defined in: packages/client/src/types/config.ts:45

Base URL for API requests

***

### getAuthToken()?

> `optional` **getAuthToken**: () => `Promise`\<`string` \| `null`\>

Defined in: packages/client/src/types/config.ts:53

Function to get auth token

#### Returns

`Promise`\<`string` \| `null`\>

***

### headers?

> `optional` **headers**: `Record`\<`string`, `string`\>

Defined in: packages/client/src/types/config.ts:51

Custom headers to include in requests

***

### timeout?

> `optional` **timeout**: `number`

Defined in: packages/client/src/types/config.ts:49

Request timeout in milliseconds

***

### wsUrl?

> `optional` **wsUrl**: `string`

Defined in: packages/client/src/types/config.ts:47

WebSocket URL for real-time events
