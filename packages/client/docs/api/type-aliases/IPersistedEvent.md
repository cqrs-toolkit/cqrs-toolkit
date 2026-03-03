[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / IPersistedEvent

# Type Alias: IPersistedEvent\<Type, Data, Metadata\>

> **IPersistedEvent**\<`Type`, `Data`, `Metadata`\> = `IEvent`\<`Type`, `Data`, `Metadata`\> & `object`

Defined in: node\_modules/@meticoeus/ddd-es/dist/src/types.d.ts:109

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

`Type` *extends* `string` = `string`

### Data

`Data` *extends* `DataType` = `DataType`

### Metadata

`Metadata` *extends* `EventMetadata` = `EventMetadata`
