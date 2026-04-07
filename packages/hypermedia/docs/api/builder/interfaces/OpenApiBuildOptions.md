[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [builder](../README.md) / OpenApiBuildOptions

# Interface: OpenApiBuildOptions

## Extends

- [`OpenApiDocumentation`](OpenApiDocumentation.md)

## Properties

### classes

> **classes**: [`ClassDef`](../../index/namespaces/HydraDoc/interfaces/ClassDef.md)\<`never`\>[]

Classes to generate OpenAPI paths from

#### Inherited from

[`OpenApiDocumentation`](OpenApiDocumentation.md).[`classes`](OpenApiDocumentation.md#classes)

---

### globalResponses?

> `optional` **globalResponses**: [`ResolvedResponseDef`](../../index/namespaces/HydraDoc/interfaces/ResolvedResponseDef.md)[]

Responses always present on every operation (e.g., 5xx codes). Cannot be opted out.

#### Inherited from

[`OpenApiDocumentation`](OpenApiDocumentation.md).[`globalResponses`](OpenApiDocumentation.md#globalresponses)

---

### hydraBuild

> **hydraBuild**: [`BuildResult`](BuildResult.md)

Hydra build result — provides all processed schemas

---

### hydraPropertyDictionary?

> `optional` **hydraPropertyDictionary**: `Record`\<`string`, [`HydraPropertyDocumentation`](HydraPropertyDocumentation.md)\>

Default schemas for hydra properties, keyed by property name (e.g. 'nb:todoId', 'svc:cursor').
Used as the default parameter schema when a mapping does not provide a per-mapping override.

#### Inherited from

[`OpenApiDocumentation`](OpenApiDocumentation.md).[`hydraPropertyDictionary`](OpenApiDocumentation.md#hydrapropertydictionary)

---

### info

> **info**: `OpenApiInfo`

#### Inherited from

[`OpenApiDocumentation`](OpenApiDocumentation.md).[`info`](OpenApiDocumentation.md#info)

---

### responses?

> `optional` **responses**: [`ResolvedResponseDef`](../../index/namespaces/HydraDoc/interfaces/ResolvedResponseDef.md)[]

Schema registry for response inheritance. Last fallback when resolving schemas by (code, contentType).

#### Inherited from

[`OpenApiDocumentation`](OpenApiDocumentation.md).[`responses`](OpenApiDocumentation.md#responses)
