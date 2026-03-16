[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HypermediaTypes](../README.md) / ResourceDescriptor

# Interface: ResourceDescriptor\<T\>

## Type Parameters

### T

`T` _extends_ `object` = `any`

## Properties

### actions?

> `optional` **actions**: [`ActionTemplate`](ActionTemplate.md)[]

---

### class

> **class**: `string`

class IRI to identify ResourceDefinition, e.g. 'storage:Rendition'

---

### context?

> `optional` **context**: `Record`\<`string`, `any`\>

Optional fallback data to resolve values for templates

---

### embedded?

> `optional` **embedded**: `Record`\<`string`, `ResourceDescriptor`\<`any`\> \| `ResourceDescriptor`\<`any`\>[]\>

---

### properties

> **properties**: `T`

actual data record
