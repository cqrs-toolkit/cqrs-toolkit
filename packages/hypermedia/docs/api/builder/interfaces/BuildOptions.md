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
