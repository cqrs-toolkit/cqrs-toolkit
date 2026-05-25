[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CustomColumn

# Interface: CustomColumn

A custom column on a managed read-model table.

Emitted as a SQLite **VIRTUAL** generated column derived from
`_effective_data`. VIRTUAL avoids row-level storage duplication — column
values are computed on demand; indexes that reference the column still
store their key values (intrinsic to indexing, not to generated-column
kind). At 1e5+ rows under OPFS quotas, STORED's per-row duplication is
unacceptable; VIRTUAL is the only kind exposed by this surface.

Mode A (in-memory) ignores `columns` entirely — they're a SQL-mode concern.
The consumer-facing row shape on both backends remains
`JSON.parse(_effective_data)`.

## Properties

### collation?

> `optional` **collation**: `string`

SQLite collating sequence applied to the column. Default `BINARY`.

Built-in names — `BINARY`, `NOCASE`, `RTRIM` — are always accepted.
`NOCASE` enables index-backed case-insensitive prefix `LIKE` queries.

Any other name must be declared on [CqrsConfig.collations](CqrsConfig.md#collations) and is
matched against that registry at schema-build time.

---

### expression?

> `optional` **expression**: `string`

Escape hatch — raw SQLite expression dropped into the
`GENERATED ALWAYS AS (...)` clause verbatim. Mutually exclusive with
`path`. Use for case-folded sort keys, computed values across multiple
fields, or anything `json_extract` alone can't express.

Example: `lower(json_extract(_effective_data, '$.name'))`.

---

### name

> **name**: `string`

Column name. Must be snake*case, start with a lowercase letter, and not
begin with `*`(library-owned prefix) or`\_\_`(library-owned prefix).
Must not collide with library-owned columns:`id`, `updated_at`.

---

### path?

> `optional` **path**: `string`

Simple JSONPath into `_effective_data`. Library emits
`json_extract(_effective_data, '<path>')` as the generated-column
expression. Mutually exclusive with `expression`.

Subset accepted: root `$`, dot members, bracket members (`['key']`),
array indexes. Wildcards (`[*]`) are rejected — `json_extract` returns
a single scalar, not an array.

---

### type

> **type**: `"TEXT"` \| `"INTEGER"` \| `"REAL"`
