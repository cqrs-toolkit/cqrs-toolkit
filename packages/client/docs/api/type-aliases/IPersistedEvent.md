[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IPersistedEvent

# Type Alias: IPersistedEvent\<Type, Data, Metadata\>

> **IPersistedEvent**\<`Type`, `Data`, `Metadata`\> = `IEvent`\<`Type`, `Data`, `Metadata`\> & `object`

Defined in: node_modules/@meticoeus/ddd-es/dist/src/types.d.ts:109

## Type Declaration

### created

> **created**: `string`

ISO 8601 timestamp of when the event was created in the event store

### id

> **id**: `string`

### position

> **position**: `bigint`

### revision

> **revision**: `bigint`

### streamId

> **streamId**: `string`

## Type Parameters

### Type

`Type` _extends_ `string` = `string`

### Data

`Data` _extends_ `DataType` = `DataType`

### Metadata

`Metadata` _extends_ `EventMetadata` = `EventMetadata`
