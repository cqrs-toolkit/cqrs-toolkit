# @cqrs-toolkit/client-solid

SolidJS reactive primitives for [`@cqrs-toolkit/client`](../client/README.md).
Provides `createListQuery` and `createItemQuery` -- thin wrappers that bridge the client's query manager into SolidJS stores with fine-grained reactivity.

## Install

```bash
npm install @cqrs-toolkit/client-solid
```

Peer dependency: `solid-js ^1.6.0`.

## Quick Start

```tsx
import { createListQuery } from '@cqrs-toolkit/client-solid'

function TodosPage() {
  const client = useClient() // your app's client context

  const query = createListQuery<Todo>(client.queryManager, 'todos')

  return (
    <Show when={!query.loading} fallback={<p>Loading...</p>}>
      <p>{query.total} todos</p>
      <For each={query.items}>{(todo) => <TodoItem todo={todo} />}</For>
    </Show>
  )
}
```

## `createListQuery`

Reactive list query that subscribes to collection changes.

```typescript
function createListQuery<T extends Identifiable>(
  queryManager: IQueryManager,
  collection: string,
  options?: ListQueryOptions,
): ListQueryState<T>
```

Fetches the collection immediately, subscribes via `watchCollection`, and refetches on each update.
Uses `createStore` + `reconcile` with `key: 'id'` for stable `<For>` identity.
Automatically holds the cache key and releases it on cleanup.

### `ListQueryState<T>`

| Property          | Type           | Description                                                  |
| ----------------- | -------------- | ------------------------------------------------------------ |
| `items`           | `readonly T[]` | The current list of items                                    |
| `loading`         | `boolean`      | `true` until the first fetch completes                       |
| `total`           | `number`       | Total count (may differ from `items.length` with pagination) |
| `hasLocalChanges` | `boolean`      | Whether any items have unconfirmed optimistic updates        |
| `error`           | `unknown`      | Set if a fetch fails                                         |

### `ListQueryOptions`

| Option   | Type     | Description                    |
| -------- | -------- | ------------------------------ |
| `scope`  | `string` | Custom scope for the cache key |
| `limit`  | `number` | Max items to return            |
| `offset` | `number` | Pagination offset              |

## `createItemQuery`

Reactive single-item query that re-subscribes when the ID changes.

```typescript
function createItemQuery<T extends Identifiable>(
  queryManager: IQueryManager,
  collection: string,
  id: () => string,
  options?: ItemQueryOptions,
): ItemQueryState<T>
```

The `id` parameter is an accessor, so it re-subscribes automatically when the ID changes (e.g., route param changes).
Fetches immediately, subscribes via `watchCollection` filtered by the target ID, and refetches on matching updates.

### `ItemQueryState<T>`

| Property          | Type             | Description                                         |
| ----------------- | ---------------- | --------------------------------------------------- |
| `data`            | `T \| undefined` | The item, or `undefined` if not found               |
| `loading`         | `boolean`        | `true` until the first fetch completes              |
| `hasLocalChanges` | `boolean`        | Whether the item has unconfirmed optimistic updates |
| `error`           | `unknown`        | Set if a fetch fails                                |

### `ItemQueryOptions`

| Option  | Type     | Description                    |
| ------- | -------- | ------------------------------ |
| `scope` | `string` | Custom scope for the cache key |

### Example

```tsx
import { createItemQuery } from '@cqrs-toolkit/client-solid'

function TodoDetail() {
  const params = useParams()
  const client = useClient()

  const query = createItemQuery<Todo>(client.queryManager, 'todos', () => params.id)

  return (
    <Show when={!query.loading} fallback={<p>Loading...</p>}>
      <Show when={query.data} fallback={<p>Not found</p>}>
        {(todo) => <h1>{todo().content}</h1>}
      </Show>
    </Show>
  )
}
```

## `Identifiable`

Both primitives require items to satisfy the `Identifiable` constraint:

```typescript
interface Identifiable {
  readonly id: string
}
```

This is used by `reconcile` for stable identity tracking in `<For>` loops.
