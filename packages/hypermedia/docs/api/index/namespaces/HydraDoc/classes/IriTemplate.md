[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / IriTemplate

# Class: IriTemplate

## Constructors

### Constructor

> **new IriTemplate**(`id`, `template`, `mappings`, `variableRepresentation?`): `IriTemplate`

#### Parameters

##### id

`string`

##### template

`` `/${string}` ``

##### mappings

readonly [`IriTemplateMapping`](../interfaces/IriTemplateMapping.md)[]

##### variableRepresentation?

`"BasicRepresentation"` | `"ExplicitRepresentation"`

#### Returns

`IriTemplate`

## Properties

### id

> `readonly` **id**: `string`

---

### mappings

> `readonly` **mappings**: readonly [`IriTemplateMapping`](../interfaces/IriTemplateMapping.md)[]

---

### template

> `readonly` **template**: `` `/${string}` ``

---

### variableRepresentation?

> `readonly` `optional` **variableRepresentation**: `"BasicRepresentation"` \| `"ExplicitRepresentation"`

## Methods

### baseHref()

> **baseHref**(): `` `/${string}` ``

#### Returns

`` `/${string}` ``

---

### hasQueryExpansion()

> **hasQueryExpansion**(): `boolean`

#### Returns

`boolean`
