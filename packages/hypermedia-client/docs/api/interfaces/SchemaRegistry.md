[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / SchemaRegistry

# Interface: SchemaRegistry

Generated schema registry.

- `commands` — command name → data schema (extracted at build time). Ready for client validation.
- `common` — $ref dependencies keyed by `$id` URL. Only schemas still referenced after extraction.
- `commonCommands` — command keys whose schemas are also used as `$ref` targets by other schemas.
  Registered with AJV alongside `common` to avoid duplication.

## Properties

### commands

> **commands**: [`SchemaMap`](../type-aliases/SchemaMap.md)

---

### common

> **common**: `Record`\<`string`, `JSONSchema7`\>

---

### commonCommands?

> `optional` **commonCommands**: `string`[]
