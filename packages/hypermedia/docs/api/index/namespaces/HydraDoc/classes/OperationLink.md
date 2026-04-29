[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / OperationLink

# Class: OperationLink

`OperationLink` models a single-resource templated operation (e.g. a
download redirect, a side-effect action endpoint that returns a 302 or
a small status body).

The `operation` is a single templated surface; query expansion is
supported but not required.

Compare to [ViewRepresentation](ViewRepresentation.md), which models a _collection-style_
scoped sub-resource (with required query expansion for filters/pagination).

## Constructors

### Constructor

> **new OperationLink**(`plain`): `OperationLink`

#### Parameters

##### plain

[`PlainOperationLink`](../interfaces/PlainOperationLink.md)

#### Returns

`OperationLink`

## Properties

### deprecated?

> `readonly` `optional` **deprecated**: `boolean`

---

### id

> `readonly` **id**: `string`

---

### kind

> `readonly` **kind**: `"operation"`

Discriminator for [SupportedPropertyTarget](../type-aliases/SupportedPropertyTarget.md).

---

### operation

> `readonly` **operation**: [`QuerySurface`](QuerySurface.md)

---

### version

> `readonly` **version**: `string`
