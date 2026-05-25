[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / PageRange

# Type Alias: PageRange

> **PageRange** = \{ `kind`: `"offset"`; `limit`: `number`; `offset`: `number`; \} \| \{ `after?`: readonly `unknown`[]; `kind`: `"cursor"`; `limit`: `number`; \}

Pagination request — discriminated union to make cursor pagination a peer
of offset rather than a string-prefix convention.

The library passes `PageRange` to the SQL `query` builder so the user's
SQL can inline LIMIT/OFFSET or cursor WHERE predicates. The library never
rewrites the user's SQL; pagination clauses are entirely consumer-owned.

For the memory path, the library slices the closure's full result at
`[offset, offset + limit]` for `kind: 'offset'`. Cursor pagination on the
memory path is unsupported in V1 and throws — Mode A is the in-memory
escape hatch for small datasets, so cursor pagination there isn't worth
the consumer-API surface.
