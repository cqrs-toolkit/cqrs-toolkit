[**@cqrs-toolkit/client-electron**](../../README.md)

---

[@cqrs-toolkit/client-electron](../../modules.md) / [worker](../README.md) / StartElectronWorkerOptions

# Interface: StartElectronWorkerOptions

Options for [startElectronWorker](../functions/startElectronWorker.md).

Electron uses better-sqlite3, which does not expose
`sqlite3_create_collation_v2` (neither does `node:sqlite` at the time of
writing). A shared CQRS config that declares custom collations therefore
needs an explicit policy for the Electron variant — fail loud, or accept
BINARY ordering on the affected columns.

## Properties

### unsupportedCollations?

> `optional` **unsupportedCollations**: `"error"` \| `"degrade"`

Policy for managed columns referencing a non-built-in collation.

- `'error'` (default): construction throws with a descriptive error.
  Suitable when the same config is meant to run only in environments
  that support custom collations.
- `'degrade'`: emit DDL with the `COLLATE <name>` clause stripped for
  non-built-in collations. SQL ordering on those columns falls back
  to `BINARY`; opt-in trade-off so a shared config can boot here too.

Built-in collations (`BINARY`, `NOCASE`, `RTRIM`) are unaffected.
