[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CollationConfig

# Interface: CollationConfig

A custom SQLite collating sequence.

Names declared here are registered against every database connection the
client opens (per-connection registration — collations don't persist in
the DB file). Once registered, a [CustomColumn](CustomColumn.md) may set
`collation: '<name>'` and the same name is used by the JS-side fallback
sort in Mode A so list ordering is locale-consistent across backends.

Built-in SQLite collations (`BINARY`, `NOCASE`, `RTRIM`) are always
available without registration and need not be declared here.

The comparator must define a **total order** that is stable for the
lifetime of any index that mentions this collation name. Changing the
comparator's behaviour after rows are indexed corrupts those indexes;
a behaviour change must be accompanied by a schema migration that
`REINDEX`es the affected tables.

## Properties

### compare()

> **compare**: (`a`, `b`) => `number`

Total-ordering comparator. Wrap an Intl.Collator for locale-aware
sort: `compare: new Intl.Collator('en', { numeric: true }).compare`.

#### Parameters

##### a

`string`

##### b

`string`

#### Returns

`number`

---

### name

> **name**: `string`

Identifier referenced by [CustomColumn.collation](CustomColumn.md#collation). Must follow the
same SQL-identifier rules as a column name (snake_case, starts with a
lowercase letter). Names are matched case-insensitively by SQLite, so
`locale_en` and `LOCALE_EN` collide.
