[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / PlainOperationLink

# Interface: PlainOperationLink

## Properties

### deprecated?

> `optional` **deprecated**: `boolean`

Mark this operation link as deprecated (still documented, slated for removal).

---

### id

> **id**: `string`

JSON-LD

#### Id

for this operation link node
Format: #<prefix>-<local>-v<semver_underscored>
Example: #storage-fileobject-download-v1_0_0

---

### operation

> **operation**: [`ResourceSurface`](ResourceSurface.md)

Templated single-resource operation surface (e.g. download redirect, action endpoint).
Query expansion is supported but not required.

---

### version

> **version**: `string`

Semantic version of this operation link (SemVer), e.g. `1.0.0`.
