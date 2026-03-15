[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / AutoRevision

# Interface: AutoRevision

Serializable sentinel that tells the library to automatically fill in the
correct revision for this command.

Resolution order:

1. If there are pending commands in the aggregate chain: use the revision
   from the last command's response (`nextExpectedRevision`).
2. Otherwise: use `fallback` (the read model revision the consumer is looking at).

Must survive JSON.stringify (SQLite storage) and structuredClone (postMessage
for worker modes). Types enforce immutability at compile time.

## Properties

### \_\_autoRevision

> `readonly` **\_\_autoRevision**: `true`

---

### fallback?

> `readonly` `optional` **fallback**: `string`
