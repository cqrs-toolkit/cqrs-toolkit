[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraApiDocumentation](../README.md) / TemplatedViewLink

# Interface: TemplatedViewLink

TemplatedLink whose target is a collection-style scoped sub-resource.

## Properties

### @id

> **@id**: `string`

---

### @type

> **@type**: `"hydra:TemplatedLink"`

---

### svc:view

> **svc:view**: readonly \[[`ViewRepresentationNode`](ViewRepresentationNode.md), [`ViewRepresentationNode`](ViewRepresentationNode.md)\]

Versioned view nodes — non-empty tuple, mirroring `Class['svc:representation']`.
