[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [builder](../README.md) / ResolvedMetaBundle

# Interface: ResolvedMetaBundle

## Extends

- `ResolvedSchemaBundle`

## Properties

### apidoc

> **apidoc**: `ResolvedDocument` \| `undefined`

Resolved Hydra ApiDocumentation

---

### openapi

> **openapi**: `ResolvedDocument` \| `undefined`

Resolved OpenAPI schema

---

### schemas

> **schemas**: `ReadonlyMap`\<`string`, `string`\>

Resolved schema files keyed by relative serve path (e.g. "schemas/urn/schema/...json")

#### Inherited from

`ResolvedSchemaBundle.schemas`

---

### schemaUrns

> **schemaUrns**: `ReadonlyMap`\<`string`, `string`\>

Map of schema URN → resolved URL for all known schemas

#### Inherited from

`ResolvedSchemaBundle.schemaUrns`
