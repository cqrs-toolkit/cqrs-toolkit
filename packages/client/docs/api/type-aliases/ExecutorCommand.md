[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ExecutorCommand

# Type Alias: ExecutorCommand

> **ExecutorCommand** = [`HandlerCommand`](../interfaces/HandlerCommand.md)

Minimum command envelope shape for the domain executor dispatch layer.
Extends HandlerCommand (what the handler receives) with no additional fields —
exists as a named type for the executor's public API. Uses `unknown` for data
since the executor dispatches to type-specific handlers.
