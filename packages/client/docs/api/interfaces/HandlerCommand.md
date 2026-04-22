[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / HandlerCommand

# Interface: HandlerCommand\<TData\>

Command shape received by command handlers to produce anticipated events.
Contains the command identity, payload, and file metadata — but NOT File
blobs, revision, service, or dependency info (those are submit/send concerns).

## Extended by

- [`EnqueueCommand`](EnqueueCommand.md)

## Type Parameters

### TData

`TData` = `unknown`

## Properties

### data

> **data**: `TData`

Command data (HTTP body payload)

---

### fileRefs?

> `optional` **fileRefs**: `FileRef`[]

File attachment metadata (library-populated from `files` at enqueue time).
Available to handlers for producing anticipated events that reference file
properties (filename, mimeType, etc.).

---

### path?

> `optional` **path**: `unknown`

URL path template values (e.g. `{ id: '...' }`).

---

### type

> **type**: `string`

Command type
