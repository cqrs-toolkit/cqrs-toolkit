[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / fetchEventPage

# Function: fetchEventPage()

> **fetchEventPage**(`ctx`, `endpoint`, `cursor`, `limit`): `Promise`\<`SeedEventPage`\>

Fetch a page of events from a hypermedia-formatted aggregate events endpoint.

## Parameters

### ctx

`FetchContext`

Fetch context with baseUrl, headers, and signal

### endpoint

`string`

Relative endpoint path (e.g. '/api/events/todos')

### cursor

Pagination cursor (null for first page)

`string` | `null`

### limit

`number`

Page size

## Returns

`Promise`\<`SeedEventPage`\>
