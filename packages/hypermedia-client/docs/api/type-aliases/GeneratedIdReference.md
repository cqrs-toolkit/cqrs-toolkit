[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../globals.md) / GeneratedIdReference

# Type Alias: GeneratedIdReference

> **GeneratedIdReference** = \{ `aggregateUrn`: `string`; `kind`: `"id"`; `path`: `string`; \} \| \{ `aggregateUrns`: `string`[]; `kind`: `"link"`; `path`: `string`; \}

A typed-field annotation row in the generated representation manifest.
Captures everything `getGeneratedIdReferences` needs to materialise a
runtime `IdReference` against an `AggregateRegistry`.

Self-id entries (no aggregateUrn) are filtered out at generation time —
they affect codegen typing only and have no runtime consumer.
