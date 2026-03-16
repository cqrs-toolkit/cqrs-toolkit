[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HAL](../README.md) / EmbeddedResourceDefinition

# Interface: EmbeddedResourceDefinition

## Properties

### class

> **class**: `string`

related resource class IRI (e.g. 'iam:TeamCategory')

---

### embedRel?

> `optional` **embedRel**: `string`

Override the default rel (prefix:kebab-case(localPart)).
Useful for cases where the rel differs from the class-local-name.
