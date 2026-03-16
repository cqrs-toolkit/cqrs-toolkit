[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [builder](../README.md) / GenerateConfig

# Interface: GenerateConfig

## Extends

- [`BuildOptions`](BuildOptions.md)

## Properties

### classes

> **classes**: [`ClassDef`](../../index/namespaces/HydraDoc/interfaces/ClassDef.md)\<`never`\>[]

#### Inherited from

[`BuildOptions`](BuildOptions.md).[`classes`](BuildOptions.md#classes)

---

### extraContext?

> `optional` **extraContext**: `Record`\<`string`, `any`\>

Add extra context terms (rare); merged after built-ins and prefixes.

#### Inherited from

[`BuildOptions`](BuildOptions.md).[`extraContext`](BuildOptions.md#extracontext)

---

### outputDir

> **outputDir**: `string`

Directory to write output files (apidoc.jsonld, schemas/, etc.)

---

### prefixes

> **prefixes**: `string`[]

Domain CURIE prefix names used in classes/mappings.
The builder auto-constructs stable `urn:vocab:${name}#` IRIs for committed artifacts.
The resolve step maps these to `${docsEntrypoint}/vocab/${name}#` at build/serve time.

#### Inherited from

[`BuildOptions`](BuildOptions.md).[`prefixes`](BuildOptions.md#prefixes)

---

### strictPrefixes?

> `optional` **strictPrefixes**: `boolean`

On unknown prefix, throw (true) or just warn (false). Default: true.

#### Inherited from

[`BuildOptions`](BuildOptions.md).[`strictPrefixes`](BuildOptions.md#strictprefixes)
