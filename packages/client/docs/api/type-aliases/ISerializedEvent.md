[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / ISerializedEvent

# Type Alias: ISerializedEvent\<Type, Data, Metadata\>

> **ISerializedEvent**\<`Type`, `Data`, `Metadata`\> = `IEvent`\<`Type`, `Data`, `Metadata`\> & `object`

Defined in: node\_modules/@meticoeus/ddd-es/dist/src/types.d.ts:125

## Type Declaration

### created

> **created**: `string`

ISO 8601 timestamp of when the event was created in the event store

### id

> **id**: `string`

### position

> **position**: `string`

Int64 encoded as a string for JSON compatibility

### revision

> **revision**: `string`

Int64 encoded as a string for JSON compatibility

### streamId

> **streamId**: `string`

## Type Parameters

### Type

`Type` *extends* `string` = `string`

### Data

`Data` *extends* `DataType` = `DataType`

### Metadata

`Metadata` *extends* `EventMetadata` = `EventMetadata`
