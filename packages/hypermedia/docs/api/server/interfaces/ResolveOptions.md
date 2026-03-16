[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [server](../README.md) / ResolveOptions

# Interface: ResolveOptions

## Properties

### parentKeys?

> `optional` **parentKeys**: `object`

Provide parent keys explicitly (used when the parent is skipped or not requested).
Example: parentKeys['storage:FileObject'] = ['f_1', 'f_2']

#### Index Signature

\[`className`: `string`\]: `string`[]

---

### skip?

> `optional` **skip**: `string`[]

Skip retrieval for these class tokens (already loaded in main query).
Output will include an entry with { skipped: true }.
