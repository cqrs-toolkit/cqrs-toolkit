[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / PlainViewRepresentation

# Interface: PlainViewRepresentation

## Properties

### base

> **base**: [`Representation`](../classes/Representation.md)\<`any`\>

Canonical representation being viewed.

- Items are still this class, with canonical @id/\_links.self
- We reuse its resource surface to avoid copy/paste/drift.

---

### collection

> **collection**: [`CollectionSurface`](CollectionSurface.md)

Collection/search surface for this view.
This is the only "new" surface the view introduces.

---

### deprecated?

> `optional` **deprecated**: `boolean`

Mark this view representation as deprecated (still documented, slated for removal).

---

### id

> **id**: `string`

JSON-LD

#### Id

for this view representation node
Format: #<prefix>-<local>-v<semver_underscored>
Example: #pms-requirement-file-objects-v1_0_0

---

### version

> **version**: `string`

Semantic version of this view representation (SemVer), e.g., "1.0.0".
