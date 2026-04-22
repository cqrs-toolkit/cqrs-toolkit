[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EnqueueCommand

# Interface: EnqueueCommand\<TData\>

Command to enqueue via `client.submit()`.
Extends the handler shape with submit-time concerns: File blobs, revision,
service routing, and dependency declarations.

## Extends

- [`HandlerCommand`](HandlerCommand.md)\<`TData`\>

## Type Parameters

### TData

`TData` = `unknown`

## Properties

### data

> **data**: `TData`

Command data (HTTP body payload)

#### Inherited from

[`HandlerCommand`](HandlerCommand.md).[`data`](HandlerCommand.md#data)

---

### dependsOn?

> `optional` **dependsOn**: `string`[]

Commands this depends on (optional)

---

### fileRefs?

> `optional` **fileRefs**: `FileRef`[]

File attachment metadata (library-populated from `files` at enqueue time).
Available to handlers for producing anticipated events that reference file
properties (filename, mimeType, etc.).

#### Inherited from

[`HandlerCommand`](HandlerCommand.md).[`fileRefs`](HandlerCommand.md#filerefs)

---

### files?

> `optional` **files**: `File`[]

File attachments for upload commands. Provide File objects (from input elements or `new File()`).

---

### path?

> `optional` **path**: `unknown`

URL path template values (e.g. `{ id: '...' }`).

#### Inherited from

[`HandlerCommand`](HandlerCommand.md).[`path`](HandlerCommand.md#path)

---

### revision?

> `optional` **revision**: `string` \| [`AutoRevision`](AutoRevision.md)

Revision for optimistic concurrency (mutate commands). Absent for creates.

---

### service?

> `optional` **service**: `string`

Target service (optional, defaults to primary)

---

### type

> **type**: `string`

Command type

#### Inherited from

[`HandlerCommand`](HandlerCommand.md).[`type`](HandlerCommand.md#type)
