[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [server](../README.md) / RepresentationProfile

# Type Alias: RepresentationProfile\<Locals, Context, Request, UseResolve\>

> **RepresentationProfile**\<`Locals`, `Context`, `Request`, `UseResolve`\> = `UseResolve` _extends_ `true` ? `object` : `object`

RepresentationProfile:

- If UseResolve = true → `resolve` is REQUIRED. Handle normal resource cases.
- If UseResolve = false → `resolve` is OPTIONAL. Handle route resolution manually.

## Type Parameters

### Locals

`Locals`

### Context

`Context`

### Request

`Request` _extends_ [`Request`](../namespaces/Hypermedia/interfaces/Request.md) = [`Request`](../namespaces/Hypermedia/interfaces/Request.md)

### UseResolve

`UseResolve` _extends_ `boolean` = `boolean`
