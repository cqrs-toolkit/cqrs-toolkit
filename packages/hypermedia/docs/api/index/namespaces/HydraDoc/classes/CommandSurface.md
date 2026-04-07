[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / CommandSurface

# Class: CommandSurface\<Ext\>

Shared surface selectable by dispatch.

## Extends

- `BaseCommandSurface`

## Type Parameters

### Ext

`Ext` _extends_ `string`

## Constructors

### Constructor

> **new CommandSurface**\<`Ext`\>(`plain`): `CommandSurface`\<`Ext`\>

#### Parameters

##### plain

[`PlainCommonCommandSurface`](../interfaces/PlainCommonCommandSurface.md)\<`Ext`\>

#### Returns

`CommandSurface`\<`Ext`\>

#### Overrides

`BaseCommandSurface.constructor`

## Properties

### description?

> `readonly` `optional` **description**: `string`

---

### dispatch

> `readonly` **dispatch**: [`CommandDispatch`](../type-aliases/CommandDispatch.md)\<`Ext`\>

---

### method

> `readonly` **method**: `"POST"`

#### Inherited from

`BaseCommandSurface.method`

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
