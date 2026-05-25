[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SQLiteStorageConfig

# Interface: SQLiteStorageConfig

SQLite storage configuration.

## Properties

### backendLabel?

> `optional` **backendLabel**: `string`

Human-readable backend label used in the `'error'` policy's error
message. Defaults to `'this SQLite backend'`.

---

### collations?

> `optional` **collations**: readonly [`CollationConfig`](CollationConfig.md)[]

Custom collations referenced by the schema. Validated against
[CustomColumn.collation](CustomColumn.md#collation) references at construction time; the
actual registration against the SQLite connection happens in
`loadAndOpenDb`.

---

### db

> **db**: [`ISqliteDb`](ISqliteDb.md)

Injected async SQLite database handle

---

### migrations

> **migrations**: \[[`SchemaMigration`](SchemaMigration.md), `...SchemaMigration[]`\]

Schema migrations — validated at construction time

---

### unsupportedCollations?

> `optional` **unsupportedCollations**: `UnsupportedCollationsPolicy`

Policy applied when the active SQLite backend can't register custom
collations (better-sqlite3 in Electron — neither it nor `node:sqlite`
currently expose `sqlite3_create_collation_v2`). Built-in names
(`BINARY`, `NOCASE`, `RTRIM`) are unaffected either way.

Omit (or leave `undefined`) for backends that do support collations —
the sqlite-wasm path in the worker modes. Setting this field signals
"the backend won't register comparators; here's what to do about any
custom names the migrations declare."

- `'error'`: throw at construction. Suitable as the conservative
  default in Electron so a misaligned config fails loud, not at first
  query.
- `'degrade'`: emit DDL with the `COLLATE <name>` clause stripped for
  non-built-in collations. SQL ordering falls back to `BINARY` on those
  columns; locale-aware ordering is lost for the SQL path. Explicit
  consumer opt-in so the same shared config can boot across
  environments.
