[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / HandlerCommand

# Interface: HandlerCommand\<TData, TPath\>

Command shape received by command handlers to produce anticipated events.
Contains the command identity, payload, file metadata, and the envelope
headers (with any [EntityRef](EntityRef.md)s visible) — but NOT File blobs,
revision, service, or dependency info (those are submit/send concerns).

## Extended by

- [`EnqueueCommand`](EnqueueCommand.md)

## Type Parameters

### TData

`TData` = `unknown`

### TPath

`TPath` = `unknown`

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

### headers?

> `optional` **headers**: `Record`\<`string`, [`EntityId`](../type-aliases/EntityId.md)\>

Escape-hatch envelope headers.

Values may be plain strings or [EntityId](../type-aliases/EntityId.md) (string | [EntityRef](EntityRef.md)).
EntityRef positions must be declared on the registration's
`commandIdReferences` (e.g. `$.headers['x-tenant-id']`) so the queue
auto-wires a `dependsOn` on the producing command and rewrites the
temp id to the server id in place once the parent resolves.

Headers are not user-validated; they are not stripped at submit and
the handler sees the same `EntityRef`s the consumer submitted. By
send-time the cascade has flattened every declared [EntityRef](EntityRef.md)
to a server-id string and the queue narrows the type to
`Record<string, string>` for the sender.

---

### path?

> `optional` **path**: `TPath`

URL path template values (e.g. `{ id: '...' }`).

---

### type

> **type**: `string`

Command type
