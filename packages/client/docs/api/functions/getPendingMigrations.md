[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / getPendingMigrations

# Function: getPendingMigrations()

> **getPendingMigrations**(`currentVersion`): [`Migration`](../interfaces/Migration.md)[]

Defined in: [packages/client/src/storage/schema/migrations.ts:45](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/schema/migrations.ts#L45)

Get migrations that need to be applied.

## Parameters

### currentVersion

`number`

Currently applied version

## Returns

[`Migration`](../interfaces/Migration.md)[]

Migrations to apply
