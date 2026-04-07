[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [builder](../README.md) / loadMetaBundle

# Function: loadMetaBundle()

> **loadMetaBundle**(`opts`): [`ResolvedMetaBundle`](../interfaces/ResolvedMetaBundle.md)

Load committed schema artifacts from disk and resolve URNs to dereferenceable URLs.
Reads `apidoc.jsonld` and all `.json` files under `schemas/` from `sourceDir`.

## Parameters

### opts

#### apiEntrypoint

`string`

#### docsEntrypoint

`string`

#### schemaUrnResolver

`SchemaUrnResolver` \| `undefined`

#### sourceDir

`string`

## Returns

[`ResolvedMetaBundle`](../interfaces/ResolvedMetaBundle.md)
