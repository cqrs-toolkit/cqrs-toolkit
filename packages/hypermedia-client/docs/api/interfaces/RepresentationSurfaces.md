[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / RepresentationSurfaces

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

### itemEvents

> **itemEvents**: [`SurfaceEndpoint`](SurfaceEndpoint.md)

Per-aggregate item events surface

---

### resource

> **resource**: [`SurfaceEndpoint`](SurfaceEndpoint.md)

Single resource surface

---

### version

> **version**: `string`

Semver version
