[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / PlainCommandSurfaceBase

# Interface: PlainCommandSurfaceBase

Shared shape for any command surface.

- Commands are invoked via HTTP (currently always POST).
- Command surfaces MUST NOT use RFC6570 query expansion in this system.
- Path variables (e.g. "{id}") are documented via template mappings.

## Extended by

- [`PlainCommonCommandSurface`](PlainCommonCommandSurface.md)
- [`PlainCustomCommandSurface`](PlainCustomCommandSurface.md)

## Properties

### method

> **method**: `"POST"`

HTTP method for invoking this command surface.

---

### template

> **template**: [`PlainIriTemplate`](PlainIriTemplate.md)

URI template describing how to invoke this surface.

Examples:

- "/api/chat/rooms" (create)
- "/api/chat/rooms/{id}/command" (envelope commands)
- "/api/chat/rooms/association" (custom endpoint)
