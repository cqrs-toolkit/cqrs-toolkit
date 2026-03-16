[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / ClassDef

# Interface: ClassDef\<Ext\>

## Type Parameters

### Ext

`Ext` _extends_ `string` = `never`

## Properties

### class

> **class**: `string`

class IRI, e.g. 'storage:FileObject'

---

### commands?

> `optional` **commands**: [`CommandsDef`](../classes/CommandsDef.md)\<`Ext`\>

CQRS command capabilities and surfaces (NOT coupled to read representation versions)

---

### representations

> **representations**: ([`Representation`](../classes/Representation.md)\<[`EventsConfig`](../type-aliases/EventsConfig.md) \| `undefined`\> \| [`ViewRepresentation`](../classes/ViewRepresentation.md))[]
