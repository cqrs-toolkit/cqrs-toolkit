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

### extraSchemas?

> `optional` **extraSchemas**: `Iterable`\<`JSONSchema7`, `any`, `any`\>

Top-level schemas to register and emit alongside hydra-walked schemas. Use for
schemas that may not be reachable through any apidoc surface (e.g. error
responses surfaced only via OpenAPI globalResponses / responses) so they still
participate in the same single SchemaRegistry as everything else —
preserving identity-based dedup, `$id` collision detection, immutability
tracking, and auto-extraction of nested `$id` sub-schemas (including any
embedded inside a `oneOf` / `anyOf` union of problem variants for the same
status code).

The same schema instance may also be reached through hydra walks; overlap is
handled by the same path/identity dedup and `$id` collision checks that apply
to hydra-walked schemas. Callers do not need to filter out schemas that hydra
already covers.

Iterated **once**, **before** the class walk. Pass references — never clones —
so SchemaRegistry's identity-based bookkeeping continues to function.
Each yielded schema must have a `$id`.

#### Inherited from

[`BuildOptions`](BuildOptions.md).[`extraSchemas`](BuildOptions.md#extraschemas)

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
