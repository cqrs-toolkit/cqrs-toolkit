[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / PlainRepresentation

# Interface: PlainRepresentation\<E\>

## Type Parameters

### E

`E` _extends_ [`EventsConfig`](../type-aliases/EventsConfig.md) \| `undefined` = `undefined`

## Properties

### collection

> **collection**: [`CollectionSurface`](CollectionSurface.md)

Collection/search surface for this class.
profile format: urn:profile:<service.Domain>Collection:<semver>

---

### deprecated?

> `optional` **deprecated**: `boolean`

Mark this representation as deprecated (still documented, slated for removal).

---

### events?

> `optional` **events**: `E`

optional events surfaces

---

### id

> **id**: `string`

JSON-LD

#### Id

for this representation node
Format: #<prefix>-<local>-v<semver_underscored>
Example: #storage-fileobject-v1_0_0

---

### resource

> **resource**: [`ResourceSurface`](ResourceSurface.md)

Single-resource surface of this class (GET by id).
profile format: urn:profile:<service.Domain>:<semver>

---

### version

> **version**: `string`

Semantic version of this representation (SemVer), e.g., "1.0.0".
