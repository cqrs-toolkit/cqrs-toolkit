[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / PlainIriTemplate

# Interface: PlainIriTemplate

## Properties

### id

> **id**: `string`

JSON-LD

#### Id

(use a fragment for doc-local anchors)

---

### mappings

> **mappings**: readonly [`IriTemplateMapping`](IriTemplateMapping.md)[]

---

### template

> **template**: `` `/${string}` ``

RFC6570 template. For collections this is typically a query template:
"/api/foo{?q,limit,cursor}"
For resources it MAY be a path template:
"/api/foo/{id}"

---

### variableRepresentation?

> `optional` **variableRepresentation**: `"BasicRepresentation"` \| `"ExplicitRepresentation"`

Optional RFC6570 variable representation hint, e.g. "ExplicitRepresentation" for arrays
