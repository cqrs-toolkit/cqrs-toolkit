[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../globals.md) / RepresentationSurfaces

# Interface: RepresentationSurfaces

All surfaces for a single representation version.

## Properties

### aggregateEvents

> **aggregateEvents**: [`SurfaceEndpoint`](SurfaceEndpoint.md)

Global aggregate events surface

---

### collection

> **collection**: [`SurfaceEndpoint`](SurfaceEndpoint.md)

Collection surface

---

### generatedIdReferences?

> `optional` **generatedIdReferences**: [`GeneratedIdReference`](../type-aliases/GeneratedIdReference.md)[]

ID-bearing fields surfaced from this rep's HAL resource schema via
`idReferences` in the consumer config. Used by `getGeneratedIdReferences`
to construct runtime `IdReference[]` for `createCollection`.

---

### itemEvents

> **itemEvents**: [`SurfaceEndpoint`](SurfaceEndpoint.md)

Per-aggregate item events surface

---

### resource

> **resource**: [`SurfaceEndpoint`](SurfaceEndpoint.md)

Single resource surface

---

### urn

> **urn**: `string`

Representation URN, e.g. `urn:representation:nb.Todo:1.0.0`.

---

### version

> **version**: `string`

Semver version
