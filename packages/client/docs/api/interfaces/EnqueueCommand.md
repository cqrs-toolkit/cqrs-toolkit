[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EnqueueCommand

# Interface: EnqueueCommand\<TData\>

Command to enqueue.

## Type Parameters

### TData

`TData` = `unknown`

## Properties

### data

> **data**: `TData`

Command data (HTTP body payload)

---

### dependsOn?

> `optional` **dependsOn**: `string`[]

Commands this depends on (optional)

---

### files?

> `optional` **files**: `File`[]

File attachments for upload commands. Provide File objects (from input elements or `new File()`).

---

### path?

> `optional` **path**: `unknown`

URL path template values (e.g. `{ id: '...' }`). Used by the command sender for URL expansion.

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
