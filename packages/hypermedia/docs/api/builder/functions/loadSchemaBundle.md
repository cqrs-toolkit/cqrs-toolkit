[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [builder](../README.md) / loadSchemaBundle

# Function: loadSchemaBundle()

> **loadSchemaBundle**(`opts`): [`ResolvedSchemaBundle`](../interfaces/ResolvedSchemaBundle.md)

Load committed schema artifacts from disk and resolve URNs to dereferenceable URLs.
Reads `apidoc.jsonld` and all `.json` files under `schemas/` from `sourceDir`.

## Parameters

### opts

#### apiEntrypoint

`string`

#### docsEntrypoint

`string`

#### sourceDir

`string`

## Returns

[`ResolvedSchemaBundle`](../interfaces/ResolvedSchemaBundle.md)
