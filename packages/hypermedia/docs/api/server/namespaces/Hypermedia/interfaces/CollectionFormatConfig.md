[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [server](../../../README.md) / [Hypermedia](../README.md) / CollectionFormatConfig

# Interface: CollectionFormatConfig

## Extends

- [`ResourceFormatConfig`](ResourceFormatConfig.md)

## Properties

### collectionDef

> **collectionDef**: [`CollectionDefinition`](../../../../index/namespaces/HAL/type-aliases/CollectionDefinition.md)

---

### halDefs

> **halDefs**: [`ResourceDefinition`](../../../../index/namespaces/HAL/interfaces/ResourceDefinition.md)[]

#### Inherited from

[`ResourceFormatConfig`](ResourceFormatConfig.md).[`halDefs`](ResourceFormatConfig.md#haldefs)

---

### linkDensity?

> `optional` **linkDensity**: `"omit"` \| `"lean"` \| `"full"`

Optional link density mode for item rendering (HAL only).

#### Overrides

[`ResourceFormatConfig`](ResourceFormatConfig.md).[`linkDensity`](ResourceFormatConfig.md#linkdensity)
