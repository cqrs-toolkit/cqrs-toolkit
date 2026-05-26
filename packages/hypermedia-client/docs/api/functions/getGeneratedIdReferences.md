[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../globals.md) / getGeneratedIdReferences

# Function: getGeneratedIdReferences()

> **getGeneratedIdReferences**\<`TLink`, `K`\>(`representationUrn`, `manifest`, `registry`): `IdReference`\<`TLink`\>[]

Look up a representation by URN and resolve its `generatedIdReferences`
into runtime `IdReference[]`.

The manifest parameter is a mapped type `{ [P in K]: RepresentationSurfaces }`
with `K` inferred at the call site. This accepts the generated
`Representations` interface's narrow literal keys (so `keyof typeof
representations` stays narrow) without requiring an index signature on
the manifest — passing a `Record<string, ...>` parameter directly would
force the codegen to widen the manifest's `keyof`.

Throws on unknown representation URN or unregistered aggregate URN.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\> = `Link`\<`string`, `string`\>

### K

`K` _extends_ `string` = `string`

## Parameters

### representationUrn

`string`

### manifest

`{ [P in string]: RepresentationSurfaces }`

### registry

[`AggregateRegistry`](../type-aliases/AggregateRegistry.md)\<`TLink`\>

## Returns

`IdReference`\<`TLink`\>[]
