[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / AggregateConfig

# Interface: AggregateConfig\<TLink\>

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### service

> **service**: `TLink` _extends_ `ServiceLink`\<`string`, `string`, `string`\> ? `TLink`\[`"service"`\] : `never`

---

### type

> **type**: `TLink`\[`"type"`\]

## Methods

### getLinkMatcher()

> **getLinkMatcher**(): `Omit`\<`TLink`, `"id"`\>

#### Returns

`Omit`\<`TLink`, `"id"`\>

---

### getStreamId()

> **getStreamId**(`entityId`): `string`

Build a stream ID from an entity ID. Accepts EntityId — implementations must
call entityIdToString() to extract the plain string.

#### Parameters

##### entityId

[`EntityId`](../type-aliases/EntityId.md)

#### Returns

`string`
