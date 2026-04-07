[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / StandardCommandSurfaceOpts

# Interface: StandardCommandSurfaceOpts

OpenAPI operation metadata shared by all surfaces (command and query).

## Extends

- [`OperationDocumentation`](OperationDocumentation.md)

## Properties

### collectionHref

> **collectionHref**: `` `/${string}` ``

---

### description?

> `optional` **description**: `string`

Human-readable description of this operation.

#### Inherited from

[`OperationDocumentation`](OperationDocumentation.md).[`description`](OperationDocumentation.md#description)

---

### idProperty

> **idProperty**: `string`

---

### idStem

> **idStem**: `string`

---

### operationId?

> `optional` **operationId**: `string`

OpenAPI operationId. Required for OpenAPI generation.

#### Inherited from

[`OperationDocumentation`](OperationDocumentation.md).[`operationId`](OperationDocumentation.md#operationid)

---

### responses?

> `optional` **responses**: readonly [`ResponseEntry`](../type-aliases/ResponseEntry.md)[]

Response documentation for this operation.

#### Inherited from

[`OperationDocumentation`](OperationDocumentation.md).[`responses`](OperationDocumentation.md#responses)

---

### responseSchemaUrn?

> `optional` **responseSchemaUrn**: `string`

URN for the oneOf union schema when 2xx responses have different schemas per contentType.

#### Inherited from

[`OperationDocumentation`](OperationDocumentation.md).[`responseSchemaUrn`](OperationDocumentation.md#responseschemaurn)
