[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [index](../README.md) / EmbeddedOutputOne

# Type Alias: EmbeddedOutputOne

> **EmbeddedOutputOne** = `object`

## Properties

### cardinality

> **cardinality**: `"one"`

---

### map?

> `optional` **map**: [`OneMap`](OneMap.md)

---

### skipped?

> `optional` **skipped**: `true`

present when caller asked to skip fetching; map may still be present if provided via prefetched
