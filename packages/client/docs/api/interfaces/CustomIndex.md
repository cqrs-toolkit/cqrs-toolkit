[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CustomIndex

# Interface: CustomIndex

An index on a managed read-model table.

Declared separately from columns to support composite indexes without
forcing every column inside a composite to also carry its own redundant
single-column index. Index columns may reference any
[CustomColumn](CustomColumn.md) on the same table or library-owned columns
(`id`, `updated_at`).

## Properties

### columns

> **columns**: readonly `string`[]

Ordered list of column names — composite-aware. Non-empty.

---

### name?

> `optional` **name**: `string`

Optional index name. Defaults to
`idx_rm_<table>_<col1>_<col2>_...` based on the column list.

---

### unique?

> `optional` **unique**: `boolean`

---

### where?

> `optional` **where**: `string`

Partial-index predicate dropped into `WHERE (...)` verbatim. Useful for
specializing hot-path filters (e.g.
`where: "status IN ('approved', 'submitted')"` to speed up aggregations
over a specific subset).
