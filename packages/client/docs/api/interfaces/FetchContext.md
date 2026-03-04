[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / FetchContext

# Interface: FetchContext

Defined in: packages/client/src/types/config.ts:95

Network context passed to collection fetch methods.

Contains the resolved base URL and headers from NetworkConfig.
If NetworkConfig.getAuthToken is configured, the resolved token is included
as an Authorization header. For cookie-based auth, no special handling is
needed — the browser sends cookies automatically with fetch().

Collections may add their own headers (e.g., Accept-Profile for versioning,
x-tenant-id for tenant context) in their fetch implementations.

## Properties

### baseUrl

> `readonly` **baseUrl**: `string`

Defined in: packages/client/src/types/config.ts:96

---

### headers

> `readonly` **headers**: `Record`\<`string`, `string`\>

Defined in: packages/client/src/types/config.ts:97

---

### signal

> `readonly` **signal**: `AbortSignal`

Defined in: packages/client/src/types/config.ts:98
