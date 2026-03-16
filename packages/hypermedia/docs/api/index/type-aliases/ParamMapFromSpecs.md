[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [index](../README.md) / ParamMapFromSpecs

# Type Alias: ParamMapFromSpecs\<Specs\>

> **ParamMapFromSpecs**\<`Specs`\> = `{ [K in ClassNameOf<Specs[number]>]: ParamsOf<Extract<Specs[number], { className: K }>> }`

## Type Parameters

### Specs

`Specs` _extends_ readonly [`AnySpec`](AnySpec.md)\<`any`, `any`\>[]
