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

### globalRequestHeaders?

> `optional` **globalRequestHeaders**: readonly [`HeaderEntry`](../../index/namespaces/HydraDoc/type-aliases/HeaderEntry.md)[]

Headers applied to every operation. Cannot be opted out; per-op same-name overrides value.

#### Inherited from

[`OpenApiDocumentation`](OpenApiDocumentation.md).[`globalRequestHeaders`](OpenApiDocumentation.md#globalrequestheaders)

---

### globalResponseHeaders?

> `optional` **globalResponseHeaders**: readonly [`HeaderEntry`](../../index/namespaces/HydraDoc/type-aliases/HeaderEntry.md)[]

Headers applied to every emitted response. Cannot be opted out; per-response same-name overrides value.

#### Inherited from

[`OpenApiDocumentation`](OpenApiDocumentation.md).[`globalResponseHeaders`](OpenApiDocumentation.md#globalresponseheaders)

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

### requestHeaders?

> `optional` **requestHeaders**: `Record`\<`string`, [`HeaderDef`](../../index/namespaces/HydraDoc/interfaces/HeaderDef.md)\>

Header registry referenced by name from operation `requestHeaders` lists.

#### Inherited from

[`OpenApiDocumentation`](OpenApiDocumentation.md).[`requestHeaders`](OpenApiDocumentation.md#requestheaders)

---

### responseHeaders?

> `optional` **responseHeaders**: `Record`\<`string`, [`HeaderDef`](../../index/namespaces/HydraDoc/interfaces/HeaderDef.md)\>

Header registry referenced by name from response `responseHeaders` lists.

#### Inherited from

[`OpenApiDocumentation`](OpenApiDocumentation.md).[`responseHeaders`](OpenApiDocumentation.md#responseheaders)

---

### responses?

> `optional` **responses**: [`ResolvedResponseDef`](../../index/namespaces/HydraDoc/interfaces/ResolvedResponseDef.md)[]

Schema registry for response inheritance. Last fallback when resolving schemas by (code, contentType).

#### Inherited from

[`OpenApiDocumentation`](OpenApiDocumentation.md).[`responses`](OpenApiDocumentation.md#responses)
