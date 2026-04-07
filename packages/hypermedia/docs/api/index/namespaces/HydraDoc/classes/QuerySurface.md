[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / QuerySurface

# Class: QuerySurface

## Constructors

### Constructor

> **new QuerySurface**(`plain`): `QuerySurface`

#### Parameters

##### plain

[`ResourceSurface`](../interfaces/ResourceSurface.md) | [`CollectionSurface`](../interfaces/CollectionSurface.md)

#### Returns

`QuerySurface`

## Properties

### description?

> `readonly` `optional` **description**: `string`

---

### formats

> `readonly` **formats**: readonly `string`[]

---

### href?

> `readonly` `optional` **href**: `` `/${string}` ``

---

### operationId?

> `readonly` `optional` **operationId**: `string`

---

### profile

> `readonly` **profile**: `string`

---

### responses?

> `readonly` `optional` **responses**: readonly [`ResponseEntry`](../type-aliases/ResponseEntry.md)[]

---

### responseSchemaUrn?

> `readonly` `optional` **responseSchemaUrn**: `string`

---

### template

> `readonly` **template**: [`IriTemplate`](IriTemplate.md)

## Accessors

### hrefBase

#### Get Signature

> **get** **hrefBase**(): `` `/${string}` ``

Non-templated canonical href (override or derived)

##### Returns

`` `/${string}` ``

---

### path

#### Get Signature

> **get** **path**(): `string`

Converts hrefBase from RFC 6570 syntax to Fastify colon parameters syntax

##### Returns

`string`

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

---

### toHalItemLinks()

> **toHalItemLinks**(): `object`

#### Returns

`object`

##### collection

> **collection**: `object`

###### collection.href

> **href**: `` `/${string}` ``
