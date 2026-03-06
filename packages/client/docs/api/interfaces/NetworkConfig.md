[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / NetworkConfig

# Interface: NetworkConfig

Defined in: [packages/client/src/types/config.ts:42](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L42)

Network configuration.

## Properties

### baseUrl

> **baseUrl**: `string`

Defined in: [packages/client/src/types/config.ts:44](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L44)

Base URL for API requests

---

### getAuthToken()?

> `optional` **getAuthToken**: () => `Promise`\<`string` \| `null`\>

Defined in: [packages/client/src/types/config.ts:52](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L52)

Function to get auth token

#### Returns

`Promise`\<`string` \| `null`\>

---

### headers?

> `optional` **headers**: `Record`\<`string`, `string`\>

Defined in: [packages/client/src/types/config.ts:50](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L50)

Custom headers to include in requests

---

### timeout?

> `optional` **timeout**: `number`

Defined in: [packages/client/src/types/config.ts:48](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L48)

Request timeout in milliseconds

---

### wsUrl?

> `optional` **wsUrl**: `string`

Defined in: [packages/client/src/types/config.ts:46](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L46)

WebSocket URL for real-time events
