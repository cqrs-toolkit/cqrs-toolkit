[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [index](../README.md) / EmbeddedOutputMany

# Type Alias: EmbeddedOutputMany

> **EmbeddedOutputMany** = `object`

## Properties

### cardinality

> **cardinality**: `"many"`

---

### map?

> `optional` **map**: [`ManyMap`](ManyMap.md)

---

### skipped?

> `optional` **skipped**: `true`

present when caller asked to skip fetching; map may still be present if provided via prefetched
