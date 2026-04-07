[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / CustomCommandSurface

# Class: CustomCommandSurface

One-off surface used only by a single command capability (not dispatch-addressable).

## Extends

- `BaseCommandSurface`

## Constructors

### Constructor

> **new CustomCommandSurface**(`plain`): `CustomCommandSurface`

#### Parameters

##### plain

[`PlainCustomCommandSurface`](../interfaces/PlainCustomCommandSurface.md)

#### Returns

`CustomCommandSurface`

#### Overrides

`BaseCommandSurface.constructor`

## Properties

### description?

> `readonly` `optional` **description**: `string`

---

### method

> `readonly` **method**: `"POST"`

#### Inherited from

`BaseCommandSurface.method`

---

### name?

> `readonly` `optional` **name**: `string`

---

### operationId?

> `readonly` `optional` **operationId**: `string`

---

### responses?

> `readonly` `optional` **responses**: readonly [`ResponseEntry`](../type-aliases/ResponseEntry.md)[]

---

### responseSchemaUrn?

> `readonly` `optional` **responseSchemaUrn**: `string`

---

### template

> `readonly` **template**: [`IriTemplate`](IriTemplate.md)

#### Inherited from

`BaseCommandSurface.template`

## Accessors

### hrefBase

#### Get Signature

> **get** **hrefBase**(): `` `/${string}` ``

Non-templated canonical href (command surfaces are always derived from template)

##### Returns

`` `/${string}` ``

#### Inherited from

`BaseCommandSurface.hrefBase`

---

### path

#### Get Signature

> **get** **path**(): `string`

Converts hrefBase from RFC 6570 syntax to Fastify colon parameters syntax

##### Returns

`string`

#### Inherited from

`BaseCommandSurface.path`
