[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / AnyViewRegistration

# Type Alias: AnyViewRegistration\<TLink\>

> **AnyViewRegistration**\<`TLink`\> = [`ViewRegistration`](../interfaces/ViewRegistration.md)\<`TLink`, `never`, `never`, `unknown`\>

Public erased registration shape — what consumers hand to
[CqrsConfig.views](../interfaces/CqrsConfig.md#views) and to the ViewExecutor constructor.

`TParams` and `TRow` resolve to `never` so any concrete
`ViewRegistration<TLink, P, R, T>` assigns without a cast: both appear
only in contravariant positions (`TParams` in `cacheKeys(params)`,
`memory(api, params)`, `sql.query(params, page)`, `sql.count(params)`;
`TRow` in `sql.transform(row)`), and a function that accepts `Specific`
trivially satisfies a contract promising only `never` will ever be
passed.

The library converts each registration into the internal
ExecutableView shape on insert; that conversion is where the
unsoundness lives (the executor must pass the caller's actual params
and the dispatcher's raw SQL rows to the registered functions).

## Type Parameters

### TLink

`TLink` _extends_ `Link`
