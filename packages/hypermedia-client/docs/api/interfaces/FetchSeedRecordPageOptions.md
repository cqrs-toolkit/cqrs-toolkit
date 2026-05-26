[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../globals.md) / FetchSeedRecordPageOptions

# Interface: FetchSeedRecordPageOptions

Options for [fetchSeedRecordPage](../functions/fetchSeedRecordPage.md).

## Properties

### ctx

> **ctx**: `FetchContext`

Fetch context with baseUrl, headers, and signal.

---

### cursor

> **cursor**: `string` \| `null`

Pagination cursor (null for first page).

---

### headers?

> `optional` **headers**: `Record`\<`string`, `string`\>

Extra headers from a `fetchHeaders` callback, merged into `ctx.headers`.

---

### limit

> **limit**: `number`

Page size.

---

### revisionPath?

> `optional` **revisionPath**: `string`

JSONPath into each member from which to extract `SeedRecord.revision`.

---

### template

> **template**: `string`

RFC 6570 URI template from `representation.collection.template`.

---

### variables

> **variables**: `Record`\<`string`, `string`\>

Path-variable map from a `fetchTemplateVariables` callback.
