[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HypermediaTypes](../README.md) / CollectionDescriptor

# Interface: CollectionDescriptor\<T, Counts\>

## Type Parameters

### T

`T` _extends_ `object` = `any`

### Counts

`Counts` _extends_ `object` = `Record`\<`string`, `any`\>

## Properties

### context?

> `optional` **context**: `Record`\<`string`, `any`\>

Optional context to resolve templated parameters in collection links

---

### counts?

> `optional` **counts**: `Counts`

---

### members

> **members**: (`T` \| [`ResourceDescriptor`](ResourceDescriptor.md)\<`T`\>)[]

---

### page

> **page**: [`PageView`](PageView.md)

---

### totalItems?

> `optional` **totalItems**: `number`
