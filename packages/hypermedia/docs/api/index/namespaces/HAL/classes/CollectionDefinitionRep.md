[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HAL](../README.md) / CollectionDefinitionRep

# Class: CollectionDefinitionRep

## Constructors

### Constructor

> **new CollectionDefinitionRep**(`def`): `CollectionDefinitionRep`

#### Parameters

##### def

`CollectionDefinitionLike`

#### Returns

`CollectionDefinitionRep`

## Properties

### curiesBaseHref?

> `readonly` `optional` **curiesBaseHref**: `string`

---

### extraLinks?

> `readonly` `optional` **extraLinks**: `object`[]

#### collection?

> `optional` **collection**: `boolean`

When true, render this rel as an array (even if there's only 1).

#### href

> **href**: `string`

#### rel

> **rel**: `string`

#### templated?

> `optional` **templated**: `boolean`

#### title?

> `optional` **title**: `string`

---

### href

> `readonly` **href**: `string`

---

### itemClass

> `readonly` **itemClass**: `string`

---

### kind

> `readonly` **kind**: `"canonical"` \| `"view"`

---

### searchTemplate

> `readonly` **searchTemplate**: `object`

#### template

> **template**: `string`

---

### useSurfaceAsMemberCollection?

> `readonly` `optional` **useSurfaceAsMemberCollection**: `boolean`

## Methods

### expandHrefBase()

> **expandHrefBase**(`collectionContext?`): `string`

Compute the concrete base href for this collection surface using collection-level context.
This _must_ fully resolve the template (no remaining `{...}`), otherwise we throw an error.

#### Parameters

##### collectionContext?

`Record`\<`string`, `any`\>

#### Returns

`string`

---

### from()

> `static` **from**(`def`): `CollectionDefinitionRep`

#### Parameters

##### def

[`CollectionDefinition`](../type-aliases/CollectionDefinition.md)

#### Returns

`CollectionDefinitionRep`
