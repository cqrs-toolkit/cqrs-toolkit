[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / Representation

# Class: Representation\<E\>

## Extends

- `BaseRepresentation`

## Type Parameters

### E

`E` _extends_ [`EventsConfig`](../type-aliases/EventsConfig.md) \| `undefined` = `undefined`

## Constructors

### Constructor

> **new Representation**\<`E`\>(`plain`): `Representation`\<`E`\>

#### Parameters

##### plain

[`PlainRepresentation`](../interfaces/PlainRepresentation.md)\<`E`\>

#### Returns

`Representation`\<`E`\>

#### Overrides

`BaseRepresentation.constructor`

## Properties

### aggregateEvents

> `readonly` **aggregateEvents**: `AggregateEventsProp`\<`E`\>

---

### collection

> `readonly` **collection**: [`QuerySurface`](QuerySurface.md)

#### Inherited from

`BaseRepresentation.collection`

---

### deprecated?

> `readonly` `optional` **deprecated**: `boolean`

---

### id

> `readonly` **id**: `string`

---

### itemEvents

> `readonly` **itemEvents**: `ItemEventsProp`\<`E`\>

---

### resource

> `readonly` **resource**: [`QuerySurface`](QuerySurface.md)

#### Inherited from

`BaseRepresentation.resource`

---

### version

> `readonly` **version**: `string`

## Accessors

### collectionHref

#### Get Signature

> **get** **collectionHref**(): `` `/${string}` ``

##### Returns

`` `/${string}` ``

#### Inherited from

`BaseRepresentation.collectionHref`

---

### collectionPath

#### Get Signature

> **get** **collectionPath**(): `string`

##### Returns

`string`

#### Inherited from

`BaseRepresentation.collectionPath`

---

### collectionTemplate

#### Get Signature

> **get** **collectionTemplate**(): `string`

##### Returns

`string`

#### Inherited from

`BaseRepresentation.collectionTemplate`

---

### resourceHref

#### Get Signature

> **get** **resourceHref**(): `` `/${string}` ``

##### Returns

`` `/${string}` ``

#### Inherited from

`BaseRepresentation.resourceHref`

---

### resourcePath

#### Get Signature

> **get** **resourcePath**(): `string`

Converts resourceHref from RFC 6570 URI Template syntax to Fastify colon parameters syntax

##### Returns

`string`

#### Inherited from

`BaseRepresentation.resourcePath`

## Methods

### toHalCollectionLinks()

> **toHalCollectionLinks**(): `object`

#### Returns

`object`

##### collection

> **collection**: `object`

###### collection.href

> **href**: `` `/${string}` ``

##### search

> **search**: `object`

###### search.href

> **href**: `` `/${string}` ``

###### search.templated

> **templated**: `true`

#### Inherited from

`BaseRepresentation.toHalCollectionLinks`

---

### toHalItemLinks()

> **toHalItemLinks**(): `object`

#### Returns

`object`

##### collection

> **collection**: `object`

###### collection.href

> **href**: `` `/${string}` ``
