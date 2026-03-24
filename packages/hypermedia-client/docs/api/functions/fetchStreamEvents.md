[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / fetchStreamEvents

# Function: fetchStreamEvents()

> **fetchStreamEvents**(`ctx`, `endpoint`, `afterRevision`): `Promise`\<`IPersistedEvent`[]\>

Fetch per-stream events for gap recovery from a hypermedia-formatted item events endpoint.

## Parameters

### ctx

`FetchContext`

Fetch context with baseUrl, headers, and signal

### endpoint

`string`

Relative endpoint path with {id} already expanded (e.g. '/api/todos/abc/events')

### afterRevision

`bigint`

Fetch events after this revision

## Returns

`Promise`\<`IPersistedEvent`[]\>
