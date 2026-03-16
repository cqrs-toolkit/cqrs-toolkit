[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [builder](../README.md) / ResolvedSchemaBundle

# Interface: ResolvedSchemaBundle

## Properties

### apidoc

> **apidoc**: `object`

#### content

> **content**: `string`

Compact canonical JSON (sorted keys, no indentation)

#### etag

> **etag**: `string`

SHA-256 hex digest of content

---

### schemas

> **schemas**: `ReadonlyMap`\<`string`, `string`\>

Resolved schema files keyed by relative serve path (e.g. "schemas/urn/schema/...json")
