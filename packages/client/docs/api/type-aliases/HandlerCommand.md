[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / HandlerCommand

# Type Alias: HandlerCommand\<TData, TPath\>

> **HandlerCommand**\<`TData`, `TPath`\> = `HandlerCommandBase`\<`TData`\> & \[`TPath`\] _extends_ \[`undefined`\] ? `object` : `unknown` _extends_ `TPath` ? `object` : `object`

Command shape received by command handlers to produce anticipated events.

`TPath` controls the `path` requirement via a distributive conditional:

- `TPath = unknown` (default, internal/queue usage) → `path?: unknown` open.
- `TPath = undefined` (consumer-side "no path" sentinel) → `path?: never`
  forbidden, catches passing a `path` to a command type that doesn't take one.
- `TPath = { id: EntityId }` (or any concrete shape) → `path: TPath` required.

Inside a registration's `handler(command, ...)` callback, `TPath` is
inferred from the matched AppCommand union member at `domain.ts`'s
`HandlerCommand<C['data'], C['path']>`, so handlers for commands that
declare `path: { id: EntityId }` get required `path` automatically.

## Type Parameters

### TData

`TData` = `unknown`

### TPath

`TPath` = `unknown`
