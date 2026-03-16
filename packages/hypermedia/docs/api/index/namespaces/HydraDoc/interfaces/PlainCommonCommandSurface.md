[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / PlainCommonCommandSurface

# Interface: PlainCommonCommandSurface\<Ext\>

A **shared** command surface registered on the class and selected by `dispatch`.

This is the normal case and exists to avoid repeating endpoint templates for
many commands that share the same HTTP route shape.

## Extends

- [`PlainCommandSurfaceBase`](PlainCommandSurfaceBase.md)

## Type Parameters

### Ext

`Ext` _extends_ `string`

## Properties

### dispatch

> **dispatch**: [`CommandDispatch`](../type-aliases/CommandDispatch.md)\<`Ext`\>

Logical surface key used to reference this surface within the class.

Examples:

- 'create' → POST /api/<svc>/<aggregate>
- 'command' → POST /api/<svc>/<aggregate>/{id}/command

Custom values are allowed if you introduce additional shared entrypoints.

NOTE: This is an internal selection key, not an HTTP routing token.

---

### method

> **method**: `"POST"`

HTTP method for invoking this command surface.

#### Inherited from

[`PlainCommandSurfaceBase`](PlainCommandSurfaceBase.md).[`method`](PlainCommandSurfaceBase.md#method)

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
