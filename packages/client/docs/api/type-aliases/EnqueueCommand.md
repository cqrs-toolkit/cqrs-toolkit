[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EnqueueCommand

# Type Alias: EnqueueCommand\<TData, TPath\>

> **EnqueueCommand**\<`TData`, `TPath`\> = [`HandlerCommand`](HandlerCommand.md)\<`TData`, `TPath`\> & `object`

Command to enqueue via `client.submit()`.

Composed from [HandlerCommand](HandlerCommand.md) with submit-time fields appended:
File blobs, revision, service routing, dependency declarations. `TPath`
threads through the conditional in [HandlerCommand](HandlerCommand.md) unchanged.

## Type Declaration

### dependsOn?

> `optional` **dependsOn**: `string`[]

Commands this depends on (optional)

### files?

> `optional` **files**: `File`[]

File attachments for upload commands. Provide File objects (from input elements or `new File()`).

### revision?

> `optional` **revision**: `string` \| [`AutoRevision`](../interfaces/AutoRevision.md)

Revision for optimistic concurrency (mutate commands). Absent for creates.

### service?

> `optional` **service**: `string`

Target service (optional, defaults to primary)

## Type Parameters

### TData

`TData` = `unknown`

### TPath

`TPath` = `unknown`
