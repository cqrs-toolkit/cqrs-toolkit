[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [builder](../README.md) / BuildOptions

# Interface: BuildOptions

## Extended by

- [`GenerateConfig`](GenerateConfig.md)

## Properties

### classes

> **classes**: [`ClassDef`](../../index/namespaces/HydraDoc/interfaces/ClassDef.md)\<`never`\>[]

---

### extraContext?

> `optional` **extraContext**: `Record`\<`string`, `any`\>

Add extra context terms (rare); merged after built-ins and prefixes.

---

### prefixes

> **prefixes**: `string`[]

Domain CURIE prefix names used in classes/mappings.
The builder auto-constructs stable `urn:vocab:${name}#` IRIs for committed artifacts.
The resolve step maps these to `${docsEntrypoint}/vocab/${name}#` at build/serve time.

---

### strictPrefixes?

> `optional` **strictPrefixes**: `boolean`

On unknown prefix, throw (true) or just warn (false). Default: true.
