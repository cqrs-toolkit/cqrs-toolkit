[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / ViewRepresentation

# Class: ViewRepresentation

ViewRepresentation explicitly models a "collection-only view" over an existing resource.

- Members are the base resource (canonical identity and by-id route).
- The view defines only a collection/search surface with service-specific filters.

## Extends

- `BaseRepresentation`

## Constructors

### Constructor

> **new ViewRepresentation**(`plain`): `ViewRepresentation`

#### Parameters

##### plain

[`PlainViewRepresentation`](../interfaces/PlainViewRepresentation.md)

#### Returns

`ViewRepresentation`

#### Overrides

`BaseRepresentation.constructor`

## Properties

### baseId

> `readonly` **baseId**: `string`

[Representation.id](Representation.md#id) of the underlying base representation.

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

### kind

> `readonly` **kind**: `"view"`

Discriminator for [SupportedPropertyTarget](../type-aliases/SupportedPropertyTarget.md).

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

HAL links that should accompany items _when they appear inside this view collection_.

IMPORTANT: In a view, the item's canonical self link should still point to the base resource.
That "self" is typically set elsewhere when rendering the item itself.

This helper provides "collection" pointing back to the view collection, not the canonical base.

#### Returns

`object`

##### collection

> **collection**: `object`

###### collection.href

> **href**: `string`
