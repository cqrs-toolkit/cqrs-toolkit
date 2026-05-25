[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LoadAndOpenDbConfig

# Interface: LoadAndOpenDbConfig

Configuration for loading and opening a local SQLite database.

## Properties

### collations?

> `optional` **collations**: readonly [`CollationConfig`](CollationConfig.md)[]

Custom collations to register against the opened connection. Built-in
SQLite collations (`BINARY`, `NOCASE`, `RTRIM`) are always available and
need not be listed.

Registration is per-connection — collation names are not persisted in
the DB file. Every code path that opens this database must register the
same set or queries against `COLLATE <name>` columns fail with
`no such collation sequence`.

---

### dbName

> **dbName**: `string`

Database file name

---

### vfs

> **vfs**: [`VfsType`](../type-aliases/VfsType.md)

VFS to use
