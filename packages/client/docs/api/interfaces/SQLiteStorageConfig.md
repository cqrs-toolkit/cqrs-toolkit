[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / SQLiteStorageConfig

# Interface: SQLiteStorageConfig

Defined in: packages/client/src/storage/SQLiteStorage.ts:47

SQLite storage configuration.

## Properties

### dbName?

> `optional` **dbName**: `string`

Defined in: packages/client/src/storage/SQLiteStorage.ts:49

Database file name

***

### sqlite?

> `optional` **sqlite**: `SqliteModule`

Defined in: packages/client/src/storage/SQLiteStorage.ts:53

Pre-initialized SQLite module (for worker contexts)

***

### vfs?

> `optional` **vfs**: [`VfsType`](../type-aliases/VfsType.md)

Defined in: packages/client/src/storage/SQLiteStorage.ts:51

VFS to use
