[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [builder](../README.md) / OpenApiDocumentation

# Interface: OpenApiDocumentation

## Extended by

- [`OpenApiBuildOptions`](OpenApiBuildOptions.md)

## Properties

### classes

> **classes**: [`ClassDef`](../../index/namespaces/HydraDoc/interfaces/ClassDef.md)\<`never`\>[]

Classes to generate OpenAPI paths from

---

### globalResponses?

> `optional` **globalResponses**: [`ResolvedResponseDef`](../../index/namespaces/HydraDoc/interfaces/ResolvedResponseDef.md)[]

Responses always present on every operation (e.g., 5xx codes). Cannot be opted out.

---

### hydraPropertyDictionary?

> `optional` **hydraPropertyDictionary**: `Record`\<`string`, [`HydraPropertyDocumentation`](HydraPropertyDocumentation.md)\>

Default schemas for hydra properties, keyed by property name (e.g. 'nb:todoId', 'svc:cursor').
Used as the default parameter schema when a mapping does not provide a per-mapping override.

---

### info

> **info**: `OpenApiInfo`

---

### responses?

> `optional` **responses**: [`ResolvedResponseDef`](../../index/namespaces/HydraDoc/interfaces/ResolvedResponseDef.md)[]

Schema registry for response inheritance. Last fallback when resolving schemas by (code, contentType).
