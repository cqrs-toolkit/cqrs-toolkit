[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / StorageConfig

# Interface: StorageConfig

Defined in: [packages/client/src/types/config.ts:32](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L32)

Storage configuration.

## Properties

### dbName?

> `optional` **dbName**: `string`

Defined in: [packages/client/src/types/config.ts:34](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L34)

Database name/path

---

### vfs?

> `optional` **vfs**: [`SqliteVfsType`](../type-aliases/SqliteVfsType.md)

Defined in: [packages/client/src/types/config.ts:36](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L36)

VFS type (auto-selected based on mode if not specified)
