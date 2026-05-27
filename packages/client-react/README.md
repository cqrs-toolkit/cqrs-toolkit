# @cqrs-toolkit/client-react

React 18 hooks for [`@cqrs-toolkit/client`](../client/README.md).
Companion to [`@cqrs-toolkit/client-solid`](../client-solid/README.md) — same surface (params shape, returned state shape, lifecycle semantics), translated to React idioms.

## Install

```bash
npm install @cqrs-toolkit/client-react
```

Peer dependency: `react ^18.0.0`.

## Quick Start

```tsx
import { CqrsProvider, useListQuery, useScopeCacheKey } from '@cqrs-toolkit/client-react'

function App() {
  return (
    <CqrsProvider client={cqrsClient}>
      <TodosPage />
    </CqrsProvider>
  )
}

function TodosPage() {
  const cacheKey = useScopeCacheKey({ scopeType: 'todos' })
  const query = useListQuery<ServiceLink, Todo>({ collection: 'todos', cacheKey })

  if (query.loading) return <p>Loading…</p>
  return (
    <>
      <p>{query.total} todos</p>
      <ul>
        {query.items.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </>
  )
}
```

## Exports

- `CqrsProvider`, `useClient` — context.
- `useEntityCacheKey`, `useScopeCacheKey` — cache-key registration.
- `useListQuery`, `useItemQuery`, `useViewQuery` — query primitives.

The full API reference is generated under [`docs/api/`](docs/api/).

## Parity with client-solid

The two packages share their state shapes (`ListQueryState`, `ItemQueryState`, `ViewQueryState`, `ListQueryStatus`, `ViewQueryStatus`, `Identifiable`, `ReconciledId`) and their session lifecycle semantics. Inputs are plain values in React (no zero-arg accessors); the hooks diff across renders and restart sessions or refetch in-session according to the same rules `client-solid` enforces.

## License

MIT
