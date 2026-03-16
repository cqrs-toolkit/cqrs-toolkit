[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [builder](../README.md) / BuildResult

# Interface: BuildResult

## Properties

### content

> **content**: `string`

Pretty-printed, key-sorted JSON string (stable for commits)

---

### jsonld

> **jsonld**: `JsonLd`

JSON-LD ApiDocumentation object

---

### schemas

> **schemas**: `Map`\<`string`, [`SchemaEntry`](SchemaEntry.md)\>

Versioned schema files to write. Key = relative path, value = schema entry.

---

### warnings

> **warnings**: `string`[]

Non-fatal warnings, if any
