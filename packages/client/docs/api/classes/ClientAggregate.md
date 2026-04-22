[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ClientAggregate

# Class: ClientAggregate\<TLink\>

Type exports for the CQRS Client library.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Implements

- [`AggregateConfig`](../interfaces/AggregateConfig.md)\<`TLink`\>

## Constructors

### Constructor

> **new ClientAggregate**\<`TLink`\>(`config`): `ClientAggregate`\<`TLink`\>

#### Parameters

##### config

`Omit`\<[`AggregateConfig`](../interfaces/AggregateConfig.md)\<`TLink`\>, `"getLinkMatcher"`\>

#### Returns

`ClientAggregate`\<`TLink`\>

## Properties

### getStreamId()

> `readonly` **getStreamId**: (`entityId`) => `string`

Build a stream ID from an entity ID. Accepts EntityId — implementations must
call entityIdToString() to extract the plain string.

#### Parameters

##### entityId

[`EntityId`](../type-aliases/EntityId.md)

#### Returns

`string`

#### Implementation of

[`AggregateConfig`](../interfaces/AggregateConfig.md).[`getStreamId`](../interfaces/AggregateConfig.md#getstreamid)

---

### service

> `readonly` **service**: `TLink` _extends_ `ServiceLink`\<`string`, `string`, `string`\> ? `TLink`\[`"service"`\] : `never`

#### Implementation of

[`AggregateConfig`](../interfaces/AggregateConfig.md).[`service`](../interfaces/AggregateConfig.md#service)

---

### type

> `readonly` **type**: `TLink`\[`"type"`\]

#### Implementation of

[`AggregateConfig`](../interfaces/AggregateConfig.md).[`type`](../interfaces/AggregateConfig.md#type)

## Methods

### getLinkMatcher()

> **getLinkMatcher**(): `Omit`\<`TLink`, `"id"`\>

#### Returns

`Omit`\<`TLink`, `"id"`\>

#### Implementation of

[`AggregateConfig`](../interfaces/AggregateConfig.md).[`getLinkMatcher`](../interfaces/AggregateConfig.md#getlinkmatcher)
