[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [index](../README.md) / EmbeddedOutput

# Type Alias: EmbeddedOutput\<Specs\>

> **EmbeddedOutput**\<`Specs`\> = `{ [K in ClassNameOf<Specs[number]>]: CardOf<Extract<Specs[number], { className: K }>> extends "one" ? EmbeddedOutputOne : EmbeddedOutputMany }`

What resolve() returns on success, keyed by className.
No nesting; formatter composes.

## Type Parameters

### Specs

`Specs` _extends_ readonly [`AnySpec`](AnySpec.md)\<`any`, `any`\>[]
