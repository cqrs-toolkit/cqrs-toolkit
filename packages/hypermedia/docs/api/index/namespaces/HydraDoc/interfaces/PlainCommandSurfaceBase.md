[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / PlainCommandSurfaceBase

# Interface: PlainCommandSurfaceBase

Shared shape for any command surface.

- Commands are invoked via HTTP (currently always POST).
- Command surfaces MUST NOT use RFC6570 query expansion in this system.
- Path variables (e.g. "{id}") are documented via template mappings.

## Extends

- [`OperationDocumentation`](OperationDocumentation.md)

## Extended by

- [`PlainCommonCommandSurface`](PlainCommonCommandSurface.md)
- [`PlainCustomCommandSurface`](PlainCustomCommandSurface.md)

## Properties

### description?

> `optional` **description**: `string`

Human-readable description of this operation.

#### Inherited from

[`OperationDocumentation`](OperationDocumentation.md).[`description`](OperationDocumentation.md#description)

---

### method

> **method**: `"POST"`

HTTP method for invoking this command surface.

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

---

### template

> **template**: [`PlainIriTemplate`](PlainIriTemplate.md)

URI template describing how to invoke this surface.

Examples:

- "/api/chat/rooms" (create)
- "/api/chat/rooms/{id}/command" (envelope commands)
- "/api/chat/rooms/association" (custom endpoint)
