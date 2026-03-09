[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / FetchContext

# Interface: FetchContext

Network context passed to collection fetch methods.

Contains the resolved base URL and headers from NetworkConfig.
If AuthStrategy.getHttpHeaders is configured, the resolved headers are
merged in. For cookie-based auth, no special handling is needed — the
browser sends cookies automatically with fetch().

Collections may add their own headers (e.g., Accept-Profile for versioning,
x-tenant-id for tenant context) in their fetch implementations.

## Properties

### baseUrl

> `readonly` **baseUrl**: `string`

---

### headers

> `readonly` **headers**: `Record`\<`string`, `string`\>

---

### signal

> `readonly` **signal**: `AbortSignal`
