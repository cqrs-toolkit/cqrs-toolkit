[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / HeaderEntry

# Type Alias: HeaderEntry

> **HeaderEntry** = `string` \| [`NamedHeaderDef`](../interfaces/NamedHeaderDef.md)

Either a string (registry reference by header name) or an inline [NamedHeaderDef](../interfaces/NamedHeaderDef.md).
Mirrors the `ResponseEntry = number | ResponseDef` pattern. String references are looked
up in the OpenAPI config's header registry at build time.
