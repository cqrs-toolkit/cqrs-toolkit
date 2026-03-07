# Per-Read-Model Tables

Status: **deferred** — sticking with the single `read_models` table until it proves to be a problem.

## Problem

The current design stores all read models in a single `read_models` table with `server_data` and `effective_data` as JSON blobs.
This means queries like "all complete tasks where projectId = x" require loading every row, deserializing JSON, and filtering in JS.
Per-read-model tables with typed columns enable indexed, field-level SQL queries.

## Design

### SQL philosophy, not ORM

The library only accepts SQL strings — never DDL objects or schema definitions.
An optional helper (`createTable`) can generate SQL from a simple object for trivial cases, but it just returns a string that gets passed into config like any hand-written SQL.
Consumers who need indexes, constraints, or anything beyond the basics write SQL directly.

### Consumer responsibilities

1. **DDL migrations** — `CREATE TABLE` SQL for each read model, registered per collection.
2. **Processors** — unchanged from today; emit `{ collection, id, update: set | merge | delete }`.
3. **Read queries** — SQL for domain-specific queries (filtered, aggregated, cross-scope). For simple cases (by id, by cache key), the library generates reads automatically.

### Library responsibilities

1. **Migration infrastructure** — versioned, ordered migrations. Consumers provide SQL strings.
2. **Write generation** — processor output maps directly to SQL:
   - `set` -> `INSERT OR REPLACE INTO {table} (...) VALUES (...)`
   - `merge` -> `UPDATE {table} SET ... WHERE id = ?`
   - `delete` -> `DELETE FROM {table} WHERE id = ?`
3. **Basic reads** — `SELECT * FROM {table} WHERE id = ?` and `SELECT * FROM {table} WHERE "_cacheKey" = ?`.
4. **Cache eviction** — `DELETE FROM {table} WHERE "_cacheKey" = ?`.
5. **Optimistic state tracking** — managed via `_` prefixed columns on the consumer's table.

### Column naming

SQLite supports double-quoted camelCase identifiers (`"projectId"`, `"createdAt"`).
Processor data keys map 1:1 to column names with no conversion.
The library quotes all column names in generated writes.

### Library-managed columns

Each consumer table includes columns managed by the library:

```sql
"_cacheKey" TEXT NOT NULL,
"_serverData" TEXT,           -- NULL unless local changes are pending
"_hasLocalChanges" INTEGER NOT NULL DEFAULT 0
```

- **Normal state**: `_serverData` is NULL, data columns hold confirmed server data.
- **Optimistic state**: `_serverData` holds the JSON baseline, data columns hold merged effective data.
- **On server confirmation**: `_serverData` -> NULL, `_hasLocalChanges` -> 0.

The `createTable` helper appends these automatically.
Consumers writing raw DDL add them manually (documented convention).

### Query API

| Use case                  | API                                                             |
| ------------------------- | --------------------------------------------------------------- |
| All items in scope        | `list<Todo>('todos')`                                           |
| Filtered within scope     | `list<Todo>('todos', { filter: t => t.status === 'complete' })` |
| Cross-scope / aggregation | Raw SQL on the db handle                                        |

`list()` is already scoped by cache key, so the dataset is bounded.
The filter predicate is a refinement on a small result set — works identically on both SQLite and InMemoryStorage.
No query builder, no declarative filter objects.

### Collection config

```ts
const todosCollection: Collection = {
  name: 'todos',
  migrations: [todosMigration], // string[] — SQL only
  // ...existing: getTopics, matchesStream, fetchSeedEvents, etc.
}
```

### Example: helper vs raw SQL

```ts
// Option A: helper for simple cases (returns a SQL string)
const todosMigration = createTable('todos', {
  id: 'text primary key',
  content: 'text not null',
  status: 'text not null',
  projectId: 'text not null',
  createdAt: 'integer not null',
  updatedAt: 'integer not null',
})

// Option B: raw SQL for full control
const todosMigration = `
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL,
  "_cacheKey" TEXT NOT NULL,
  "_serverData" TEXT,
  "_hasLocalChanges" INTEGER NOT NULL DEFAULT 0
)`
```

Both produce the same thing: a SQL string passed into `collection.migrations`.
