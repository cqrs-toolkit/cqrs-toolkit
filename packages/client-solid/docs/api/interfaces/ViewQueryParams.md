[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / ViewQueryParams

# Interface: ViewQueryParams\<TParams\>

Parameters for `createViewQuery`.

View name is static (it's a config-time identifier); params and page can
be either static or reactive accessors. When a reactive accessor returns
`undefined`, the query enters an inactive state (loading, no data) — useful
for navigation flows where the params come from a route that's not yet
matched.

## Type Parameters

### TParams

`TParams` = `unknown`

## Properties

### page?

> `optional` **page**: `PageRange` \| () => PageRange \| undefined

Optional page. Static or reactive accessor.

---

### params

> **params**: `TParams` \| () => `TParams` \| `undefined`

Params bag for the view. Static or reactive accessor.

---

### view

> **view**: `string`

View name as registered in `CqrsConfig.views`.
