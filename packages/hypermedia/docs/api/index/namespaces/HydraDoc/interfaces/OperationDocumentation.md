[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / OperationDocumentation

# Interface: OperationDocumentation

OpenAPI operation metadata shared by all surfaces (command and query).

## Extended by

- [`PlainCommandSurfaceBase`](PlainCommandSurfaceBase.md)
- [`PlainQuerySurface`](PlainQuerySurface.md)
- [`StandardCreateCommandSurfaceOpts`](StandardCreateCommandSurfaceOpts.md)
- [`StandardCommandSurfaceOpts`](StandardCommandSurfaceOpts.md)

## Properties

### description?

> `optional` **description**: `string`

Human-readable description of this operation.

---

### operationId?

> `optional` **operationId**: `string`

OpenAPI operationId. Required for OpenAPI generation.

---

### responses?

> `optional` **responses**: readonly [`ResponseEntry`](../type-aliases/ResponseEntry.md)[]

Response documentation for this operation.

---

### responseSchemaUrn?

> `optional` **responseSchemaUrn**: `string`

URN for the oneOf union schema when 2xx responses have different schemas per contentType.
