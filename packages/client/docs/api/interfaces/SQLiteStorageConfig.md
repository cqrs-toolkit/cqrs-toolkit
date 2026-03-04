[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SQLiteStorageConfig

# Interface: SQLiteStorageConfig

Defined in: packages/client/src/storage/SQLiteStorage.ts:68

SQLite storage configuration.

## Properties

### dbName?

> `optional` **dbName**: `string`

Defined in: packages/client/src/storage/SQLiteStorage.ts:70

Database file name

---

### sqlite?

> `optional` **sqlite**: `SqliteModule`

Defined in: packages/client/src/storage/SQLiteStorage.ts:74

Pre-initialized SQLite module (for worker contexts)

---

### vfs?

> `optional` **vfs**: [`VfsType`](../type-aliases/VfsType.md)

Defined in: packages/client/src/storage/SQLiteStorage.ts:72

VFS to use
