[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / SQLiteStorageConfig

# Interface: SQLiteStorageConfig

Defined in: packages/client/src/storage/SQLiteStorage.ts:46

SQLite storage configuration.

## Properties

### dbName?

> `optional` **dbName**: `string`

Defined in: packages/client/src/storage/SQLiteStorage.ts:48

Database file name

---

### sqlite?

> `optional` **sqlite**: `SqliteModule`

Defined in: packages/client/src/storage/SQLiteStorage.ts:52

Pre-initialized SQLite module (for worker contexts)

---

### vfs?

> `optional` **vfs**: [`VfsType`](../type-aliases/VfsType.md)

Defined in: packages/client/src/storage/SQLiteStorage.ts:50

VFS to use
