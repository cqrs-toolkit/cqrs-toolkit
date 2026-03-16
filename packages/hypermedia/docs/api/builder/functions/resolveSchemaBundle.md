[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [builder](../README.md) / resolveSchemaBundle

# Function: resolveSchemaBundle()

> **resolveSchemaBundle**(`opts`): [`ResolvedSchemaBundle`](../interfaces/ResolvedSchemaBundle.md)

Resolve a schema bundle from an in-memory BuildResult.
Transforms URN-based `$id`, `$ref`, and `svc:jsonSchema` values to dereferenceable URLs.
Produces compact canonical JSON with a SHA-256 ETag.

## Parameters

### opts

#### apiEntrypoint

`string`

#### buildResult

[`BuildResult`](../interfaces/BuildResult.md)

#### docsEntrypoint

`string`

## Returns

[`ResolvedSchemaBundle`](../interfaces/ResolvedSchemaBundle.md)
