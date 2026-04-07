[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / PlainCustomCommandSurface

# Interface: PlainCustomCommandSurface

A **custom** command surface used only by a single capability.

This surface is _not_ part of the class's shared surface table and is not
referenced by dispatch. It exists for rare commands that use a bespoke route.

You may optionally provide a human-friendly label for debugging/diffs.

## Extends

- [`PlainCommandSurfaceBase`](PlainCommandSurfaceBase.md)

## Properties

### description?

> `optional` **description**: `string`

Human-readable description of this operation.

#### Inherited from

[`PlainCommandSurfaceBase`](PlainCommandSurfaceBase.md).[`description`](PlainCommandSurfaceBase.md#description)

---

### method

> **method**: `"POST"`

HTTP method for invoking this command surface.

#### Inherited from

[`PlainCommandSurfaceBase`](PlainCommandSurfaceBase.md).[`method`](PlainCommandSurfaceBase.md#method)

---

### name?

> `optional` **name**: `string`

Optional label for humans/logging; not used for resolution.

---

### operationId?

> `optional` **operationId**: `string`

OpenAPI operationId. Required for OpenAPI generation.

#### Inherited from

[`PlainCommandSurfaceBase`](PlainCommandSurfaceBase.md).[`operationId`](PlainCommandSurfaceBase.md#operationid)

---

### responses?

> `optional` **responses**: readonly [`ResponseEntry`](../type-aliases/ResponseEntry.md)[]

Response documentation for this operation.

#### Inherited from

[`PlainCommandSurfaceBase`](PlainCommandSurfaceBase.md).[`responses`](PlainCommandSurfaceBase.md#responses)

---

### responseSchemaUrn?

> `optional` **responseSchemaUrn**: `string`

URN for the oneOf union schema when 2xx responses have different schemas per contentType.

#### Inherited from

[`PlainCommandSurfaceBase`](PlainCommandSurfaceBase.md).[`responseSchemaUrn`](PlainCommandSurfaceBase.md#responseschemaurn)

---

### template

> **template**: [`PlainIriTemplate`](PlainIriTemplate.md)

URI template describing how to invoke this surface.

Examples:

- "/api/chat/rooms" (create)
- "/api/chat/rooms/{id}/command" (envelope commands)
- "/api/chat/rooms/association" (custom endpoint)

#### Inherited from

[`PlainCommandSurfaceBase`](PlainCommandSurfaceBase.md).[`template`](PlainCommandSurfaceBase.md#template)
