[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / Sort

# Type Alias: Sort

> **Sort** = readonly [`SortTerm`](../interfaces/SortTerm.md)[]

Composite sort spec — ordered list of [SortTerm](../interfaces/SortTerm.md)s. Earlier terms
dominate; later terms break ties. Used by both `list` for ordering and by
paged subscriptions for cursor pagination and Gate 3 boundary checks.

The `sort` field on [ListParams](../interfaces/ListParams.md) overrides the collection-level
default ([Collection.list](../interfaces/Collection.md#list).defaultSort) when present.
